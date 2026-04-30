-- =====================================================================
-- Family Planner — Initial Schema (V1 / MVP)
-- Run this in Supabase SQL Editor (or `supabase db push`).
-- Idempotent where possible: rerunning will fail on already-existing
-- objects, so apply once or wrap in a fresh project.
-- =====================================================================

-- Required extensions ------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- =====================================================================
-- ENUM TYPES
-- =====================================================================
create type group_role as enum ('owner', 'admin', 'member');
create type group_type as enum ('family', 'team', 'club', 'organization', 'other');
create type chore_status as enum ('available', 'selected', 'in_progress', 'completed', 'approved', 'rejected');
create type reward_type as enum ('money', 'screen_time_minutes', 'points', 'badge', 'custom');
create type goal_type as enum ('walking_distance_km', 'walking_count', 'chore_count', 'reading_count', 'custom');
create type goal_period as enum ('daily', 'weekly', 'monthly', 'custom_range');
create type goal_status as enum ('active', 'completed', 'failed', 'archived');
create type notification_channel as enum ('in_app', 'email', 'push_web', 'push_mobile');
create type calendar_provider as enum ('google', 'outlook', 'apple');
create type sync_direction as enum ('read_only', 'write_only', 'two_way');
create type event_kind as enum ('school', 'chore', 'activity', 'walk', 'goal_milestone', 'custom');

-- =====================================================================
-- TABLES
-- =====================================================================

-- Profiles -------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text,
  avatar_url text,
  birth_date date,
  color_hex text default '#7C3AED',
  auth_kind text default 'email' check (auth_kind in ('email','pin_only','sso')),
  pin_hash text,
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

-- Groups ---------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type group_type not null default 'family',
  description text,
  invite_code text unique,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index idx_groups_owner on public.groups (owner_id);

-- Group members --------------------------------------------------------
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role group_role not null default 'member',
  nickname text,
  color_hex text,
  joined_at timestamptz default now(),
  unique (group_id, profile_id)
);
create index idx_gm_group on public.group_members (group_id);
create index idx_gm_profile on public.group_members (profile_id);

-- Invitations ----------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  invited_email text,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  role group_role not null default 'member',
  token text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id),
  created_at timestamptz default now()
);
create index idx_invitations_group on public.invitations (group_id);
create index idx_invitations_token on public.invitations (token);

-- Timetable entries (school) -------------------------------------------
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
  start_date date not null,
  recurrence_rule text,
  exception_dates date[] default '{}',
  color_hex text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index idx_tt_group_profile on public.timetable_entries (group_id, profile_id);
create index idx_tt_start_date on public.timetable_entries (start_date);

-- Chores (templates) ---------------------------------------------------
create table public.chores (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  description text,
  estimated_minutes int,
  recurrence_rule text,
  reward_type reward_type,
  reward_value numeric(12,2),
  reward_custom_text text,
  requires_approval boolean default true,
  pool_enabled boolean default false,
  default_assignee_id uuid references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index idx_chores_group on public.chores (group_id);

-- Chore assignments (instances) ----------------------------------------
create table public.chore_assignments (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null references public.chores(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  assigned_to uuid references public.profiles(id),
  due_date date,
  status chore_status not null default 'available',
  selected_at timestamptz,
  completed_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  rejection_reason text,
  proof_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_ca_group_status on public.chore_assignments (group_id, status);
create index idx_ca_assigned on public.chore_assignments (assigned_to, status);
create index idx_ca_due on public.chore_assignments (due_date);

-- Rewards (definitions / library) --------------------------------------
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

-- Reward transactions (ledger) -----------------------------------------
create table public.reward_transactions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type reward_type not null,
  amount numeric(12,2) not null,
  source_kind text not null,
  source_id uuid,
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);
create index idx_rt_profile_type on public.reward_transactions (profile_id, type);
create index idx_rt_group_created on public.reward_transactions (group_id, created_at desc);

-- Reward balances view -------------------------------------------------
create view public.reward_balances as
select
  profile_id,
  group_id,
  type,
  sum(amount) as balance
from public.reward_transactions
group by profile_id, group_id, type;

-- Walking entries ------------------------------------------------------
create table public.walking_entries (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  occurred_on date not null,
  distance_km numeric(6,2) not null,
  duration_minutes int,
  notes text,
  participant_ids uuid[] not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now()
);
create index idx_we_group_date on public.walking_entries (group_id, occurred_on);
create index idx_we_participants on public.walking_entries using gin (participant_ids);

-- Goals ----------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  type goal_type not null,
  target_value numeric(12,2) not null,
  period goal_period not null,
  period_start date not null,
  period_end date,
  recurrence_rule text,
  assignee_ids uuid[] not null,
  reward_type reward_type,
  reward_value numeric(12,2),
  reward_custom_text text,
  status goal_status not null default 'active',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_goals_group_status on public.goals (group_id, status);
create index idx_goals_assignees on public.goals using gin (assignee_ids);

-- Goal progress --------------------------------------------------------
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

-- Events (generic calendar items) --------------------------------------
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
create index idx_events_group_start on public.events (group_id, starts_at);
create index idx_events_participants on public.events using gin (participant_ids);

-- Event exceptions -----------------------------------------------------
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

-- Calendar integrations ------------------------------------------------
create table public.calendar_integrations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  provider calendar_provider not null,
  external_account_email text,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  selected_calendar_ids text[] default '{}',
  direction sync_direction not null default 'read_only',
  last_synced_at timestamptz,
  is_enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Notifications --------------------------------------------------------
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
create index idx_notifications_recipient on public.notifications (recipient_id, read_at);

-- Notification preferences ---------------------------------------------
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

-- Collision check preferences ------------------------------------------
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

-- =====================================================================
-- HELPER FUNCTIONS
-- =====================================================================

create or replace function public.is_group_member(p_group uuid, p_profile uuid default auth.uid())
returns boolean
language sql security definer stable as $$
  select exists(
    select 1 from public.group_members
    where group_id = p_group and profile_id = p_profile
  );
$$;

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

-- updated_at trigger ---------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Auto-create profile on auth.users insert -----------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
    new.email
  )
  on conflict (id) do nothing;

  insert into public.notification_preferences (profile_id) values (new.id)
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Award reward on chore approval --------------------------------------
create or replace function public.award_chore_reward()
returns trigger language plpgsql security definer as $$
declare
  v_chore record;
begin
  if NEW.status = 'approved' and (OLD.status is distinct from 'approved') then
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
            coalesce(v_chore.reward_custom_text, v_chore.reward_value::text),
            'chore', NEW.id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_award_chore_reward on public.chore_assignments;
create trigger trg_award_chore_reward
  after update on public.chore_assignments
  for each row execute function public.award_chore_reward();

-- Add updated_at triggers to all relevant tables -----------------------
do $$
declare
  tbl text;
begin
  for tbl in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_at'
  loop
    execute format(
      'drop trigger if exists trg_set_updated_at on public.%I; ' ||
      'create trigger trg_set_updated_at before update on public.%I ' ||
      'for each row execute function public.set_updated_at();',
      tbl, tbl);
  end loop;
end$$;

-- Auto-add owner as group_member on group create -----------------------
create or replace function public.add_owner_as_member()
returns trigger language plpgsql security definer as $$
begin
  insert into public.group_members (group_id, profile_id, role)
  values (NEW.id, NEW.owner_id, 'owner')
  on conflict (group_id, profile_id) do nothing;
  return NEW;
end;
$$;

drop trigger if exists trg_add_owner_as_member on public.groups;
create trigger trg_add_owner_as_member
  after insert on public.groups
  for each row execute function public.add_owner_as_member();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

-- Enable RLS on all tables --------------------------------------------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.invitations enable row level security;
alter table public.timetable_entries enable row level security;
alter table public.chores enable row level security;
alter table public.chore_assignments enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_transactions enable row level security;
alter table public.walking_entries enable row level security;
alter table public.goals enable row level security;
alter table public.goal_progress enable row level security;
alter table public.events enable row level security;
alter table public.event_exceptions enable row level security;
alter table public.calendar_integrations enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.collision_check_preferences enable row level security;

-- Profiles -------------------------------------------------------------
create policy "profiles_self_or_shared_group_read" on public.profiles
  for select using (
    id = auth.uid()
    or exists(
      select 1 from public.group_members gm1
      join public.group_members gm2 on gm2.group_id = gm1.group_id
      where gm1.profile_id = auth.uid() and gm2.profile_id = profiles.id
    )
  );

create policy "profiles_self_update" on public.profiles
  for update using (id = auth.uid());

-- Groups ---------------------------------------------------------------
create policy "groups_member_read" on public.groups
  for select using (public.is_group_member(id));

create policy "groups_authenticated_insert" on public.groups
  for insert with check (auth.uid() is not null and owner_id = auth.uid());

create policy "groups_owner_update" on public.groups
  for update using (owner_id = auth.uid());

create policy "groups_owner_delete" on public.groups
  for delete using (owner_id = auth.uid());

-- Group members --------------------------------------------------------
create policy "gm_member_read" on public.group_members
  for select using (public.is_group_member(group_id));

create policy "gm_admin_insert" on public.group_members
  for insert with check (public.is_group_admin(group_id) or profile_id = auth.uid());

create policy "gm_admin_update" on public.group_members
  for update using (public.is_group_admin(group_id));

create policy "gm_admin_delete" on public.group_members
  for delete using (public.is_group_admin(group_id) or profile_id = auth.uid());

-- Invitations ----------------------------------------------------------
create policy "invitations_admin_all" on public.invitations
  for all using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

-- Timetable entries ----------------------------------------------------
create policy "tt_member_read" on public.timetable_entries
  for select using (public.is_group_member(group_id));

create policy "tt_self_or_admin_write" on public.timetable_entries
  for all using (
    profile_id = auth.uid() or public.is_group_admin(group_id)
  ) with check (
    profile_id = auth.uid() or public.is_group_admin(group_id)
  );

-- Chores (templates) ---------------------------------------------------
create policy "chores_member_read" on public.chores
  for select using (public.is_group_member(group_id));

create policy "chores_admin_write" on public.chores
  for all using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

-- Chore assignments ----------------------------------------------------
create policy "ca_member_read" on public.chore_assignments
  for select using (public.is_group_member(group_id));

create policy "ca_admin_write" on public.chore_assignments
  for all using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

create policy "ca_self_pickup_or_complete" on public.chore_assignments
  for update using (
    public.is_group_member(group_id) and (
      assigned_to = auth.uid()
      or (assigned_to is null and status = 'available')
    )
  ) with check (
    public.is_group_member(group_id)
    and assigned_to = auth.uid()
    and status in ('selected','in_progress','completed')
  );

-- Rewards --------------------------------------------------------------
create policy "rewards_member_read" on public.rewards
  for select using (public.is_group_member(group_id));

create policy "rewards_admin_write" on public.rewards
  for all using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

-- Reward transactions --------------------------------------------------
create policy "rt_member_read_self" on public.reward_transactions
  for select using (
    profile_id = auth.uid() or public.is_group_admin(group_id)
  );

create policy "rt_admin_insert" on public.reward_transactions
  for insert with check (public.is_group_admin(group_id));

-- Walking entries ------------------------------------------------------
create policy "we_member_read" on public.walking_entries
  for select using (public.is_group_member(group_id));

create policy "we_member_write" on public.walking_entries
  for all using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

-- Goals ----------------------------------------------------------------
create policy "goals_member_read" on public.goals
  for select using (public.is_group_member(group_id));

create policy "goals_admin_write" on public.goals
  for all using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

-- Goal progress --------------------------------------------------------
create policy "gp_member_read" on public.goal_progress
  for select using (
    profile_id = auth.uid()
    or exists(
      select 1 from public.goals g
      where g.id = goal_progress.goal_id and public.is_group_admin(g.group_id)
    )
  );

create policy "gp_self_or_admin_write" on public.goal_progress
  for all using (
    profile_id = auth.uid()
    or exists(
      select 1 from public.goals g
      where g.id = goal_progress.goal_id and public.is_group_admin(g.group_id)
    )
  ) with check (true);

-- Events ---------------------------------------------------------------
create policy "events_member_read" on public.events
  for select using (public.is_group_member(group_id));

create policy "events_member_write" on public.events
  for all using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

-- Event exceptions -----------------------------------------------------
create policy "ee_member_all" on public.event_exceptions
  for all using (
    case source_kind
      when 'event' then exists(select 1 from public.events e where e.id = source_id and public.is_group_member(e.group_id))
      when 'timetable_entry' then exists(select 1 from public.timetable_entries t where t.id = source_id and public.is_group_member(t.group_id))
      when 'chore_assignment' then exists(select 1 from public.chore_assignments c where c.id = source_id and public.is_group_member(c.group_id))
      else false
    end
  ) with check (true);

-- Calendar integrations ------------------------------------------------
create policy "ci_self_all" on public.calendar_integrations
  for all using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Notifications --------------------------------------------------------
create policy "notif_self_read" on public.notifications
  for select using (recipient_id = auth.uid());

create policy "notif_self_update" on public.notifications
  for update using (recipient_id = auth.uid());

create policy "notif_system_insert" on public.notifications
  for insert with check (true);  -- inserted by triggers/edge fns

-- Notification preferences --------------------------------------------
create policy "np_self_all" on public.notification_preferences
  for all using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Collision check preferences -----------------------------------------
create policy "ccp_self_all" on public.collision_check_preferences
  for all using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- =====================================================================
-- DONE
-- =====================================================================
