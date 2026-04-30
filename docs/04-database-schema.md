# 04 — Database Schema (Supabase / Postgres)

> All identifiers, table names, and column names are in **English** to keep the schema portable and aligned with the JS/TS codebase. Comments and decision notes are in English; surrounding documents in this project are bilingual.

## Conventions

- Primary keys: `id uuid primary key default gen_random_uuid()`
- Timestamps: `created_at timestamptz default now()`, `updated_at timestamptz default now()` with trigger
- Soft delete: `deleted_at timestamptz` (nullable). RLS hides rows where this is set.
- Enums: implemented as **Postgres enums** (faster than text + check constraint, but harder to alter — see "Migration tips" below).
- Foreign keys: `on delete cascade` for child-of relationships, `on delete restrict` for cross-cutting refs.
- Auth: we **don't store passwords** — Supabase Auth handles that in `auth.users`. Our `profiles` table extends it via `id = auth.users.id`.
- Row Level Security (RLS): **enabled on every table**. Default policy: deny all. Then explicit `using` / `with check` clauses per role.

## Entity overview

```
auth.users (Supabase)
   └── profiles 1:1
                 └── group_members  N:M  ──→ groups
                                              ├── timetable_entries
                                              ├── chores ─→ chore_assignments ──→ profiles
                                              │       └── chore_completions
                                              ├── rewards (definitions)
                                              │       └── reward_transactions
                                              ├── walking_entries (per profile)
                                              ├── goals
                                              │       └── goal_progress
                                              ├── events (general calendar items)
                                              │       └── event_exceptions
                                              ├── invitations
                                              ├── calendar_integrations (per profile)
                                              ├── notification_preferences (per profile)
                                              └── notifications (per profile)
```

## Enum types

```sql
create type group_role as enum ('owner', 'admin', 'member');
create type group_type as enum ('family', 'team', 'club', 'organization', 'other');
create type chore_status as enum ('available', 'selected', 'in_progress', 'completed', 'approved', 'rejected');
create type chore_frequency as enum ('once', 'daily', 'weekly', 'monthly', 'custom');
create type reward_type as enum ('money', 'screen_time_minutes', 'points', 'badge', 'custom');
create type goal_type as enum ('walking_distance_km', 'walking_count', 'chore_count', 'reading_count', 'custom');
create type goal_period as enum ('daily', 'weekly', 'monthly', 'custom_range');
create type goal_status as enum ('active', 'completed', 'failed', 'archived');
create type notification_channel as enum ('in_app', 'email', 'push_web', 'push_mobile');
create type calendar_provider as enum ('google', 'outlook', 'apple');
create type sync_direction as enum ('read_only', 'write_only', 'two_way');
create type event_kind as enum ('school', 'chore', 'activity', 'walk', 'goal_milestone', 'custom');
```

## Tables

### `profiles`
Extends Supabase `auth.users`. One row per user. Children may have `auth_kind = 'pin_only'` and a NULL email — see the child-login note in `08-sikkerhet.md`.

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text,
  avatar_url text,
  birth_date date,
  color_hex text default '#7C3AED',  -- per-user color in calendar
  auth_kind text default 'email' check (auth_kind in ('email','pin_only','sso')),
  pin_hash text,                     -- bcrypt of PIN for child accounts
  default_collision_check_scope text default 'self',
  default_reminder_minutes int[] default array[15],
  quiet_hours_start time,
  quiet_hours_end time,
  timezone text default 'Europe/Oslo',
  locale text default 'nb-NO',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### `groups`
A family, team, club, etc.

```sql
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type group_type not null default 'family',
  description text,
  invite_code text unique,           -- short alphanumeric code (8 chars)
  owner_id uuid not null references public.profiles(id) on delete restrict,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
```

### `group_members`
Membership join. A user can be in multiple groups.

```sql
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role group_role not null default 'member',
  nickname text,                     -- override display in this group
  color_hex text,                    -- override per-group color
  joined_at timestamptz default now(),
  unique (group_id, profile_id)
);
create index on public.group_members (group_id);
create index on public.group_members (profile_id);
```

### `invitations`

```sql
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  invited_email text,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  role group_role not null default 'member',
  token text not null unique,        -- random 32 chars, used in invite link
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id),
  created_at timestamptz default now()
);
create index on public.invitations (group_id);
create index on public.invitations (token);
```

### `timetable_entries`
School lessons. RRULE-driven for recurrence.

```sql
create table public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  room text,
  teacher text,
  notes text,
  start_time time not null,
  end_time time not null,
  start_date date not null,          -- first occurrence
  recurrence_rule text,              -- RFC 5545 RRULE, e.g. FREQ=WEEKLY;BYDAY=MO;UNTIL=20260615T000000Z
  exception_dates date[] default '{}',
  color_hex text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index on public.timetable_entries (group_id, profile_id);
create index on public.timetable_entries (start_date);
```

### `chores`
Definition of a chore. Assignment lives in `chore_assignments` so one chore-template can have many assignments (e.g. weekly).

```sql
create table public.chores (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  description text,
  estimated_minutes int,
  recurrence_rule text,              -- RRULE, NULL = one-off
  reward_type reward_type,
  reward_value numeric(12,2),
  reward_custom_text text,
  requires_approval boolean default true,
  pool_enabled boolean default false, -- true = also/instead in shared pool
  default_assignee_id uuid references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index on public.chores (group_id);
```

### `chore_assignments`
A concrete instance of a chore for a specific date / person.

```sql
create table public.chore_assignments (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null references public.chores(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  assigned_to uuid references public.profiles(id),  -- null = in pool
  due_date date,
  status chore_status not null default 'available',
  selected_at timestamptz,
  completed_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  rejection_reason text,
  proof_url text,                    -- for V2 photo proof
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on public.chore_assignments (group_id, status);
create index on public.chore_assignments (assigned_to, status);
create index on public.chore_assignments (due_date);
```

### `rewards`
Optional library of reusable reward definitions (e.g. "Movie night", "Ice cream"). Not strictly needed; chores can carry inline rewards. Useful for badges and trophies.

```sql
create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  type reward_type not null,
  value numeric(12,2),
  badge_image_url text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### `reward_transactions`
Atomic ledger of all reward credits and debits per profile.

```sql
create table public.reward_transactions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type reward_type not null,
  amount numeric(12,2) not null,     -- positive = earned, negative = spent
  source_kind text not null,         -- 'chore', 'goal', 'manual', 'spend'
  source_id uuid,                    -- chore_assignments.id or goals.id
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);
create index on public.reward_transactions (profile_id, type);
create index on public.reward_transactions (group_id, created_at);
```

### `reward_balances` (materialized view or computed table)

The simplest implementation is a **view** that sums the ledger:

```sql
create view public.reward_balances as
select
  profile_id,
  group_id,
  type,
  sum(amount) as balance
from public.reward_transactions
group by profile_id, group_id, type;
```

For high-traffic apps switch to a `reward_balances` table updated via trigger.

### `walking_entries`

```sql
create table public.walking_entries (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  occurred_on date not null,
  distance_km numeric(6,2) not null,
  duration_minutes int,
  notes text,
  participant_ids uuid[] not null,   -- array of profile ids
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now()
);
create index on public.walking_entries (group_id, occurred_on);
create index on public.walking_entries using gin (participant_ids);
```

### `goals`

```sql
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  type goal_type not null,
  target_value numeric(12,2) not null,
  period goal_period not null,
  period_start date not null,
  period_end date,                   -- null for indefinite weekly recurring
  recurrence_rule text,              -- e.g. weekly goal that auto-renews
  assignee_ids uuid[] not null,      -- one or more profiles
  reward_type reward_type,
  reward_value numeric(12,2),
  reward_custom_text text,
  status goal_status not null default 'active',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on public.goals (group_id, status);
create index on public.goals using gin (assignee_ids);
```

### `goal_progress`
Snapshot per profile per goal, recomputed by trigger or scheduled function.

```sql
create table public.goal_progress (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  current_value numeric(12,2) not null default 0,
  completed_at timestamptz,
  reward_paid_at timestamptz,
  updated_at timestamptz default now(),
  unique (goal_id, profile_id)
);
```

### `events` (generic calendar items)
For activities, family events, etc. Timetable, chores and goals also surface in calendar via union views, but `events` is for *ad-hoc* and recurring calendar items.

```sql
create table public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  kind event_kind not null default 'custom',
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean default false,
  recurrence_rule text,
  participant_ids uuid[] not null,
  created_by uuid not null references public.profiles(id),
  reminder_minutes int[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index on public.events (group_id, starts_at);
create index on public.events using gin (participant_ids);
```

### `event_exceptions`
Single-occurrence overrides or deletions for recurring events / timetables.

```sql
create table public.event_exceptions (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind in ('event','timetable_entry','chore_assignment')),
  source_id uuid not null,
  occurrence_date date not null,
  is_cancelled boolean default false,
  override_starts_at timestamptz,
  override_ends_at timestamptz,
  override_title text,
  notes text,
  created_at timestamptz default now(),
  unique (source_kind, source_id, occurrence_date)
);
```

### `calendar_integrations`

```sql
create table public.calendar_integrations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  provider calendar_provider not null,
  external_account_email text,
  access_token_encrypted text,       -- encrypted via pgsodium / Vault
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  selected_calendar_ids text[] default '{}',
  direction sync_direction not null default 'read_only',
  last_synced_at timestamptz,
  is_enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### `notifications`

```sql
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  title text not null,
  body text,
  link_url text,
  source_kind text,
  source_id uuid,
  read_at timestamptz,
  delivered_channels notification_channel[] default '{}',
  created_at timestamptz default now()
);
create index on public.notifications (recipient_id, read_at);
```

### `notification_preferences`

```sql
create table public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  in_app_enabled boolean default true,
  email_enabled boolean default true,
  push_web_enabled boolean default false,
  push_mobile_enabled boolean default false,
  default_reminder_minutes int[] default array[15],
  approval_alerts boolean default true,
  goal_alerts boolean default true,
  collision_alerts boolean default true,
  quiet_hours_start time,
  quiet_hours_end time,
  updated_at timestamptz default now()
);
```

### `collision_check_preferences`

```sql
create table public.collision_check_preferences (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  scope text not null check (scope in ('self','all_children','all_admins','all_members','custom')),
  custom_profile_ids uuid[] default '{}',
  is_default boolean default false,
  created_at timestamptz default now(),
  unique (profile_id, group_id, scope)
);
```

---

## Helper functions

### `is_group_member`
Used by RLS policies.

```sql
create or replace function public.is_group_member(p_group uuid, p_profile uuid default auth.uid())
returns boolean
language sql security definer stable as $$
  select exists(
    select 1 from public.group_members
    where group_id = p_group and profile_id = p_profile
  );
$$;
```

### `is_group_admin`

```sql
create or replace function public.is_group_admin(p_group uuid, p_profile uuid default auth.uid())
returns boolean
language sql security definer stable as $$
  select exists(
    select 1 from public.group_members
    where group_id = p_group
      and profile_id = p_profile
      and role in ('owner','admin')
  );
$$;
```

---

## RLS — example policies

Same pattern is applied to every table. Example for `chores`:

```sql
alter table public.chores enable row level security;

-- Read: any group member
create policy "chores_read_members" on public.chores
  for select using (public.is_group_member(group_id));

-- Insert: admins/owners only
create policy "chores_insert_admins" on public.chores
  for insert with check (public.is_group_admin(group_id));

-- Update: admins/owners only
create policy "chores_update_admins" on public.chores
  for update using (public.is_group_admin(group_id));

-- Delete: admins/owners only
create policy "chores_delete_admins" on public.chores
  for delete using (public.is_group_admin(group_id));
```

For `chore_assignments` we need slightly more nuance — a child can update *their own* assignment (mark as completed), but only an admin can approve:

```sql
alter table public.chore_assignments enable row level security;

create policy "ca_read_members" on public.chore_assignments
  for select using (public.is_group_member(group_id));

create policy "ca_insert_admins" on public.chore_assignments
  for insert with check (public.is_group_admin(group_id));

create policy "ca_self_update" on public.chore_assignments
  for update using (
    assigned_to = auth.uid()
    and status in ('selected','in_progress')
  )
  with check (
    assigned_to = auth.uid()
    and status in ('selected','in_progress','completed')
  );

create policy "ca_admin_update" on public.chore_assignments
  for update using (public.is_group_admin(group_id));
```

Full policy listing in `supabase/migrations/0001_initial_schema.sql`.

---

## Triggers

### `updated_at`-trigger (generic)

```sql
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- attach to every table with updated_at
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
-- repeat for every relevant table
```

### Auto-create profile on auth.users insert

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), new.email);
  insert into public.notification_preferences (profile_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### Award reward on chore approval

```sql
create or replace function public.award_chore_reward()
returns trigger language plpgsql security definer as $$
declare
  v_chore record;
begin
  if NEW.status = 'approved' and OLD.status <> 'approved' then
    select reward_type, reward_value, reward_custom_text into v_chore
    from public.chores where id = NEW.chore_id;

    if v_chore.reward_type is not null and v_chore.reward_value is not null then
      insert into public.reward_transactions
        (group_id, profile_id, type, amount, source_kind, source_id, description, created_by)
      values
        (NEW.group_id, NEW.assigned_to, v_chore.reward_type, v_chore.reward_value,
         'chore', NEW.id, v_chore.reward_custom_text, NEW.approved_by);
    end if;

    insert into public.notifications (recipient_id, group_id, title, body, source_kind, source_id)
    values (NEW.assigned_to, NEW.group_id, 'Belønning mottatt!',
            format('%s', coalesce(v_chore.reward_custom_text, v_chore.reward_value::text)),
            'chore', NEW.id);
  end if;
  return NEW;
end;
$$;

create trigger trg_award_chore_reward
  after update on public.chore_assignments
  for each row execute function public.award_chore_reward();
```

---

## Migration tips

1. Use **Supabase migrations** (`supabase/migrations/*.sql`) — version-controlled and replayable.
2. **Never `drop type`** an enum after data exists. Add new values with `alter type ... add value`.
3. For **schema changes that touch RLS**, deploy SQL first, then app code that depends on the new policy.
4. **Backfill** in batches via `update ... where id in (select id ... limit 1000)` to avoid long locks.
5. Use **Supabase branches** (preview environments) for testing migrations before production.
