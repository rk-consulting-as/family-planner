# 05 — API Endpoints

> Family Planner uses **two complementary patterns** instead of a hand-written REST API:
>
> 1. **Supabase PostgREST** — auto-generated REST + TypeScript client over our Postgres schema. RLS enforces all permissions.
> 2. **Next.js Server Actions / Route Handlers** — for orchestration (multi-step operations, sending email, calling external APIs, server-side validation that goes beyond what RLS can express).
>
> This document lists what each operation looks like from the client's perspective.

---

## 1. Authentication (Supabase Auth)

| Action | Client call | Notes |
|---|---|---|
| Sign up with email | `supabase.auth.signUp({ email, password, options: { data: { display_name }}})` | Trigger creates `profile` row |
| Sign in | `supabase.auth.signInWithPassword({ email, password })` | |
| Sign out | `supabase.auth.signOut()` | |
| Reset password (request) | `supabase.auth.resetPasswordForEmail(email)` | Sends email |
| Reset password (confirm) | `supabase.auth.updateUser({ password })` | Inside reset-password page |
| Sign in with Google (V2) | `supabase.auth.signInWithOAuth({ provider: 'google' })` | OAuth redirect |
| Magic link | `supabase.auth.signInWithOtp({ email })` | Optional |

**Child PIN login** is custom (see `08-sikkerhet.md`):
- `POST /api/auth/child-pin` — `{ family_handle, child_username, pin }` → returns Supabase session

---

## 2. Groups

### List groups for current user
```ts
const { data } = await supabase
  .from('group_members')
  .select('role, group:groups(*)')
  .eq('profile_id', user.id);
```

### Create group (Server Action)
```
POST /actions/createGroup
Body: { name: string, type: 'family'|'team'|...; description?: string }
```
Server action:
1. Validate input (Zod)
2. Insert into `groups` (trigger auto-adds owner as member)
3. Return `{ id, invite_code }`

### Update group
```ts
await supabase.from('groups').update({ name, description }).eq('id', groupId);
```
RLS allows only owner.

### Get group with members
```ts
const { data } = await supabase
  .from('groups')
  .select('*, members:group_members(*, profile:profiles(*))')
  .eq('id', groupId)
  .single();
```

---

## 3. Invitations

### Create invitation (Server Action)
```
POST /actions/inviteToGroup
Body: { group_id, invited_email, role }
```
1. Generate token (32-char random)
2. Insert `invitations` row
3. Send email via Resend / Supabase SMTP
4. Return `{ invite_url }`

### Accept invitation (Server Action)
```
POST /actions/acceptInvitation
Body: { token }
Auth: required (signed-in user)
```
1. Look up token, verify not expired and not consumed
2. Insert into `group_members` with role from invitation
3. Update `invitations.accepted_at` and `accepted_by`

---

## 4. Timetable

| Action | Method |
|---|---|
| List my timetable for week | `supabase.from('timetable_entries').select().eq('profile_id', uid).gte('start_date', weekStart)` |
| List family timetable | `supabase.from('timetable_entries').select('*, profile:profiles(display_name,color_hex)').eq('group_id', gid)` |
| Create entry | `supabase.from('timetable_entries').insert({ ... })` |
| Update entry | `supabase.from('timetable_entries').update({...}).eq('id', id)` |
| Soft delete | `supabase.from('timetable_entries').update({ deleted_at: new Date().toISOString() }).eq('id', id)` |

**Recurrence handling:** Stored as RRULE string. Client expands to occurrences via `rrule.js` for the visible date range.

---

## 5. Chores

### Library (chores)
```ts
// list
supabase.from('chores').select().eq('group_id', gid).is('deleted_at', null);
// create
supabase.from('chores').insert({ group_id, title, reward_type, reward_value, ... });
```

### Assignments (instances)
```ts
// list open assignments
supabase
  .from('chore_assignments')
  .select('*, chore:chores(title, reward_type, reward_value)')
  .eq('group_id', gid)
  .in('status', ['available','selected','in_progress','completed']);
```

### Pick chore from pool (child)
Server action — wraps update + RLS check:
```
POST /actions/pickChore
Body: { assignment_id }
```
1. Verify status = 'available' and assigned_to is null
2. Update `assigned_to = auth.uid(), status = 'selected', selected_at = now()`

### Mark complete (child)
```
POST /actions/completeChore
Body: { assignment_id }
```
Updates status to `completed`, `completed_at = now()`. If chore.requires_approval = false → status goes straight to `approved` and reward fires.

### Approve / reject (admin)
```
POST /actions/reviewChore
Body: { assignment_id, decision: 'approve'|'reject', reason? }
```
1. Verify caller is admin/owner
2. Set status accordingly + `approved_by`/`approved_at`
3. Trigger `award_chore_reward` runs in DB

### Generate next assignments from RRULE
Background job (Supabase Edge Function or Vercel Cron):
```
POST /api/cron/expand-chores
```
Runs daily; for every `chores` with recurrence_rule, ensures upcoming N days have assignments.

---

## 6. Rewards

```ts
// my balances
supabase.from('reward_balances').select().eq('profile_id', uid);

// transaction history
supabase
  .from('reward_transactions')
  .select()
  .eq('profile_id', uid)
  .order('created_at', { ascending: false })
  .limit(50);
```

### Manual reward / debit (admin)
```
POST /actions/manualRewardTransaction
Body: { profile_id, type, amount, description }
```

### Spend balance (e.g. cash out screen time)
```
POST /actions/spendReward
Body: { profile_id, type, amount, description }
```
Inserts negative transaction. Server-side check that resulting balance >= 0.

---

## 7. Walking entries

```ts
// log walk
supabase.from('walking_entries').insert({
  group_id, occurred_on, distance_km, duration_minutes, notes, participant_ids: [uid]
});

// week summary
supabase.rpc('walking_week_summary', { p_group_id, p_start_date });
```

The `walking_week_summary` RPC returns aggregated km per participant per day for a date range. SQL function:

```sql
create or replace function public.walking_week_summary(
  p_group_id uuid, p_start_date date, p_end_date date default null
) returns table (
  profile_id uuid, total_km numeric, total_walks int, days date[]
)
language sql security invoker stable as $$
  select
    unnest(participant_ids) as profile_id,
    sum(distance_km) as total_km,
    count(*) as total_walks,
    array_agg(distinct occurred_on) as days
  from public.walking_entries
  where group_id = p_group_id
    and occurred_on between p_start_date and coalesce(p_end_date, p_start_date + interval '6 days')
  group by 1;
$$;
```

---

## 8. Goals

```ts
// list active
supabase.from('goals').select().eq('group_id', gid).eq('status', 'active');

// progress for me
supabase
  .from('goal_progress')
  .select('*, goal:goals(*)')
  .eq('profile_id', uid);
```

### Create goal (admin)
```
POST /actions/createGoal
```
After insert, server action also creates a `goal_progress` row per assignee with current_value computed from existing data (e.g. walks already this week).

### Recompute progress (cron)
```
POST /api/cron/recompute-goals
```
Hourly. For each active goal:
1. Compute current_value based on goal.type and assignee's data
2. If >= target_value → set completed_at, fire reward, send notification

---

## 9. Events (generic calendar)

```ts
// list events for visible week (any participant)
supabase
  .from('events')
  .select()
  .eq('group_id', gid)
  .lte('starts_at', weekEnd)
  .gte('ends_at', weekStart);
```

### Create event with collision check
```
POST /actions/createEvent
Body: { group_id, title, starts_at, ends_at, participant_ids,
        recurrence_rule?, reminder_minutes?,
        collision_check?: { scope, custom_profile_ids? } }
```
1. Validate input
2. If collision_check provided:
   - Resolve target profile set (self / all_children / all_admins / all_members / custom)
   - Query overlapping events, timetable entries, chore assignments
   - Build conflict report
3. If conflicts and `force=false` → respond `{ status: 'conflicts', conflicts: [...] }`
4. Else insert event and return `{ status: 'created', event }`

Conflict response shape:
```json
{
  "status": "conflicts",
  "summary": "2 children and 1 admin have conflicts",
  "by_profile": [
    { "profile_id": "uuid", "display_name": "Sara",
      "conflicts": [
        { "kind": "timetable_entry", "title": "Pianotime", "starts_at": "...", "ends_at": "..." }
      ]
    }
  ]
}
```
Client shows warning + "Save anyway" button → re-submits with `force=true`.

---

## 10. Notifications

```ts
// list unread
supabase
  .from('notifications')
  .select()
  .eq('recipient_id', uid)
  .is('read_at', null)
  .order('created_at', { ascending: false });

// realtime subscription
supabase
  .channel('notif')
  .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${uid}` },
      (payload) => updateUI(payload.new))
  .subscribe();

// mark as read
supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
```

### Server-side send notification helper
```ts
// lib/notifications.ts
export async function sendNotification({
  recipient_id, group_id, title, body, link_url, channels = ['in_app','email']
}) {
  // 1) Insert into notifications table
  // 2) If channels.includes('email') → send via Resend/SMTP
  // 3) If channels.includes('push_web') → fetch subscriptions, send Web Push
  // 4) Update delivered_channels
}
```

---

## 11. Calendar integrations (V2)

### Connect Google
```
GET /api/integrations/google/start?group_id=...
```
Redirects to Google OAuth consent. Callback `/api/integrations/google/callback`:
1. Exchange code for tokens
2. Encrypt + store in `calendar_integrations`
3. Redirect to settings page

### Sync now
```
POST /api/integrations/sync
Body: { integration_id }
```
Triggers a sync job. For MVP: writes app events to Google + reads busy/free for collision checks only.

### Cron: full sync
```
POST /api/cron/sync-calendars
```
Every 15 min: refreshes tokens, pushes pending writes, pulls busy/free.

---

## 12. Error responses

All Server Actions return either:
```ts
{ ok: true, data: T }
```
or
```ts
{ ok: false, error: { code: string; message: string; fields?: Record<string,string> } }
```

Common codes:
- `unauthenticated`
- `forbidden`
- `not_found`
- `validation_error`
- `conflict`
- `rate_limited`
- `external_api_error`

---

## 13. Rate limits

Implemented as a simple Postgres table `rate_limit_buckets` checked at the start of expensive Server Actions:

```sql
create table public.rate_limit_buckets (
  key text primary key,
  count int default 0,
  window_started_at timestamptz default now()
);
```

Limits in MVP:
- Invitation create: 20 / hour / user
- Chore assignment pick: 60 / hour / user
- Walking entry create: 30 / day / user
