# 10 — Reward System Logic

## Mental model

The reward system is an **append-only ledger** (`reward_transactions`) plus a derived **balance view** (`reward_balances`). Every change to anyone's balance is a row. We never mutate balances directly. This gives us:

- **Auditability** — every kr/minute/point can be traced
- **Trivial rollback** — "undo last reward" = insert opposite transaction
- **Clean reporting** — sum over date ranges, by source, by type

## Reward types

| Type | Unit | Use case | Display |
|---|---|---|---|
| `money` | kr (decimal 2dp) | Real allowance | "💰 250,00 kr" |
| `screen_time_minutes` | min (int) | Earned screen/gaming time | "📺 45 min" |
| `points` | int | Generic reward economy | "⭐ 240" |
| `badge` | n/a | Achievements (one-shot) | trophy icon |
| `custom` | text | Anything else | text + emoji |

## Sources

| `source_kind` | Triggered by |
|---|---|
| `chore` | `chore_assignments.status → approved` (DB trigger) |
| `goal` | `goal_progress.completed_at` set (cron / RPC) |
| `manual` | Admin manually credits/debits via UI |
| `spend` | User redeems balance (e.g. cashes out screen time) |
| `adjustment` | Migrations / corrections |

## Lifecycle of a chore reward

```
Chore created with reward_value=50, reward_type='money', requires_approval=true
                                  │
                                  ▼
Chore assigned to Sara, due Sunday 21:00
                                  │
                                  ▼
Sara: "Done!" → status=completed
                                  │
                                  ▼
Mom sees "Trenger godkjenning" notification
                                  │
              ┌───────────────────┼──────────────────────┐
              ▼                                          ▼
       MOM APPROVES                                MOM REJECTS
              │                                          │
              ▼                                          ▼
DB trigger inserts reward_transaction            status=rejected
  amount=+50 type=money source=chore             chore goes back to pool or
              │                                  Sara is asked to redo
              ▼
Notification "Belønning mottatt: 50 kr" → Sara
              │
              ▼
reward_balances view now shows balance += 50
```

## Lifecycle of a goal reward

```
Goal: "Walk 5 km this week" reward=30 kr type=money
                                  │
                                  ▼
Walking entries logged through the week
                                  │
                                  ▼
Cron `recompute-goals` runs hourly:
  current_value = sum(distance_km) for assignee, this period
                                  │
                ┌─────────────────┼─────────────────┐
                ▼                                   ▼
   current_value < target              current_value >= target
              (no-op)                              │
                                                   ▼
                                  goal_progress.completed_at = now()
                                                   │
                                                   ▼
                              Insert reward_transaction
                              Insert notification
                              goal_progress.reward_paid_at = now()
```

Idempotency: we only fire the reward if `reward_paid_at` is NULL.

## Spending a balance

Example: Sara has 90 minutes of `screen_time_minutes` and wants to "spend" 30.

```ts
await spendReward({
  profile_id: sara.id,
  type: 'screen_time_minutes',
  amount: 30,           // server inserts -30
  description: 'Watched movie'
});
```

Server action:
1. Verify caller is `sara` or admin in same group
2. Compute current balance from view
3. If balance - amount < 0 → reject with `insufficient_balance`
4. Insert transaction with amount = -30
5. Notification: "30 min screen time used"

## Manual transactions (admin)

Use cases:
- "I gave you 50 kr in real life, let's deduct"
- "Bonus for being amazing this week"
- Correcting a mistake

UI: form with profile, type, amount (signed), description, button to apply.

Always require an explicit description for audit.

## Badges (V1.5)

Badges are **idempotent** rewards. Defined in `rewards` table with `type='badge'`. Awarded by inserting a transaction with `amount=1` (semantically just "this badge is owned"). A profile owns a badge iff there's at least one matching transaction.

Listing badges:
```sql
select r.id, r.name, r.badge_image_url
from public.rewards r
where r.type = 'badge'
  and r.group_id = $1
  and exists(
    select 1 from public.reward_transactions rt
    where rt.profile_id = $2
      and rt.source_kind = 'badge'
      and rt.source_id = r.id
  );
```

## Streaks (V1.5)

A streak is computed, not stored:

```sql
-- Days in a row a profile has approved at least one chore
with daily as (
  select date(approved_at) as d
  from chore_assignments
  where assigned_to = $1 and status = 'approved'
  group by 1
)
-- count consecutive days from today backwards
select count(*) from (
  select d, d - row_number() over (order by d) :: int as grp
  from daily where d <= current_date
) x
where grp = (select max(grp) from (
  select d - row_number() over (order by d) :: int as grp from daily where d <= current_date
) y)
```

Streak triggers extra rewards:
- 3 days → 5 bonus points
- 7 days → 20 points + badge
- 30 days → 100 points + premium badge

## UI components

```
<RewardBalanceCard
  type="money"
  balance={250.00}
  recentTransactions={[...]}
/>

<TrophyShelf
  badges={[
    { id, name, imageUrl, awardedAt }
  ]}
/>

<RewardHistory
  profileId="..."
  filter={{ types: ['money'], from, to }}
  pageSize={20}
/>

<ManualRewardForm
  profileId="..."
  onSubmit={...}
/>
```

## Anti-patterns to avoid

| Don't do | Do instead |
|---|---|
| `update profiles set money_balance = ...` | Insert transaction, sum from view |
| Show balance on completed (not approved) chore | Wait for `approved` so unfair rewards don't slip in |
| Allow client to compute balance (untrusted) | Server-side via RLS-protected view |
| Single composite "score" for everything | Separate types — money is money, points are points |

## Edge cases

| Case | Handling |
|---|---|
| Chore approved twice (admin clicks fast) | DB trigger checks `OLD.status is distinct from 'approved'` so only fires once |
| Reward inserted, then chore deleted | `reward_transactions.source_id` is not FK-cascading; transaction stays, source becomes orphan. Audit reports flag this. |
| Negative balance | Spend operations enforce `>= 0`. Manual debit by admin can go negative (rare, intentional). |
| Currency change | Out of scope; we assume NOK for V1, store amount + locale |
| Tax / income reporting | Out of scope; this is allowance for kids, not employment |

## Reporting queries

**Total earned this month per child:**
```sql
select profile_id, type, sum(amount)
from reward_transactions
where group_id = $1 and amount > 0
  and created_at >= date_trunc('month', current_date)
group by 1, 2;
```

**Top chores by reward this quarter:**
```sql
select c.title, sum(rt.amount) as total
from reward_transactions rt
join chore_assignments ca on ca.id = rt.source_id
join chores c on c.id = ca.chore_id
where rt.source_kind = 'chore' and rt.amount > 0
  and rt.created_at >= date_trunc('quarter', current_date)
group by c.title
order by total desc;
```
