-- =====================================================================
-- BuildPlan — Boligprosjekt-planlegger
-- Prefix: bp_
-- Deler auth.users og profiles med familie-appen.
-- =====================================================================

-- ─── ENUM TYPES ───────────────────────────────────────────────────────
create type bp_member_role as enum ('owner', 'contributor', 'viewer');
create type bp_task_type   as enum ('purchase', 'hours');
create type bp_task_status as enum ('todo', 'in_progress', 'done');

-- ─── PROJECTS ─────────────────────────────────────────────────────────
create table public.bp_projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete restrict,
  name        text not null,
  description text,
  cover_color text default '#C4622D',
  archived    boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index idx_bp_projects_owner on public.bp_projects (owner_id);

-- ─── PROJECT MEMBERS ──────────────────────────────────────────────────
create table public.bp_project_members (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.bp_projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role       bp_member_role not null default 'contributor',
  joined_at  timestamptz default now(),
  unique (project_id, profile_id)
);
create index idx_bp_pm_project on public.bp_project_members (project_id);
create index idx_bp_pm_profile on public.bp_project_members (profile_id);

-- ─── AREAS ────────────────────────────────────────────────────────────
-- Feks "1. etasje", "Bad", "Garasje"
create table public.bp_areas (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.bp_projects(id) on delete cascade,
  name       text not null,
  color_hex  text default '#C4622D',
  sort_order int  default 0,
  created_at timestamptz default now()
);
create index idx_bp_areas_project on public.bp_areas (project_id);

-- ─── TASKS ────────────────────────────────────────────────────────────
create table public.bp_tasks (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.bp_projects(id) on delete cascade,
  area_id             uuid references public.bp_areas(id) on delete set null,
  parent_task_id      uuid references public.bp_tasks(id) on delete cascade,
  title               text not null,
  description         text,
  task_type           bp_task_type   not null default 'hours',
  status              bp_task_status not null default 'todo',
  assigned_to         uuid references public.profiles(id) on delete set null,
  priority            int default 0,

  -- For purchase tasks
  quantity            numeric,
  unit                text,
  price_per_unit      numeric,
  retailer_url        text,
  purchased           boolean default false,
  purchased_at        timestamptz,

  -- For hours tasks
  estimated_hours     numeric,
  avg_hours_per_day   numeric,

  -- Scheduling
  start_date          date,
  due_date            date,

  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
create index idx_bp_tasks_project on public.bp_tasks (project_id);
create index idx_bp_tasks_area    on public.bp_tasks (area_id);
create index idx_bp_tasks_parent  on public.bp_tasks (parent_task_id);

-- ─── TIME LOGS ────────────────────────────────────────────────────────
create table public.bp_time_logs (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.bp_tasks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  hours      numeric not null,
  comment    text,
  logged_at  timestamptz default now()
);
create index idx_bp_tl_task    on public.bp_time_logs (task_id);
create index idx_bp_tl_profile on public.bp_time_logs (profile_id);

-- ─── ACTIVITY LOG ─────────────────────────────────────────────────────
create table public.bp_activity_log (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.bp_projects(id) on delete cascade,
  profile_id  uuid references public.profiles(id) on delete set null,
  action      text not null,   -- feks 'task_completed', 'purchase_checked', 'time_logged'
  entity_type text,            -- 'task', 'area', 'time_log'
  entity_id   uuid,
  meta        jsonb default '{}'::jsonb,
  created_at  timestamptz default now()
);
create index idx_bp_al_project on public.bp_activity_log (project_id);
create index idx_bp_al_created on public.bp_activity_log (created_at desc);

-- ─── NOTIFICATIONS ────────────────────────────────────────────────────
create table public.bp_notifications (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.bp_projects(id) on delete cascade,
  message    text not null,
  link_type  text,   -- 'task', 'project'
  link_id    uuid,
  is_read    boolean default false,
  created_at timestamptz default now()
);
create index idx_bp_notif_profile on public.bp_notifications (profile_id, is_read);

-- ─── PROJECT INVITATIONS ──────────────────────────────────────────────
create table public.bp_invitations (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.bp_projects(id) on delete cascade,
  invited_by  uuid not null references public.profiles(id) on delete cascade,
  email       text not null,
  role        bp_member_role not null default 'contributor',
  token       text unique not null default encode(gen_random_bytes(24), 'base64url'),
  accepted_at timestamptz,
  expires_at  timestamptz default (now() + interval '7 days'),
  created_at  timestamptz default now()
);
create index idx_bp_inv_project on public.bp_invitations (project_id);
create index idx_bp_inv_token   on public.bp_invitations (token);

-- ─── UPDATED_AT TRIGGERS ──────────────────────────────────────────────
create or replace function bp_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_bp_projects_updated
  before update on public.bp_projects
  for each row execute function bp_set_updated_at();

create trigger trg_bp_tasks_updated
  before update on public.bp_tasks
  for each row execute function bp_set_updated_at();

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────

-- Helper: er brukeren medlem av prosjektet?
create or replace function bp_is_member(p_project_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.bp_project_members
    where project_id = p_project_id
      and profile_id = auth.uid()
  )
$$;

-- Helper: er brukeren eier av prosjektet?
create or replace function bp_is_owner(p_project_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.bp_projects
    where id = p_project_id
      and owner_id = auth.uid()
  )
$$;

-- Helper: er brukeren contributor eller eier?
create or replace function bp_can_edit(p_project_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.bp_project_members
    where project_id = p_project_id
      and profile_id = auth.uid()
      and role in ('owner', 'contributor')
  )
$$;

alter table public.bp_projects        enable row level security;
alter table public.bp_project_members enable row level security;
alter table public.bp_areas           enable row level security;
alter table public.bp_tasks           enable row level security;
alter table public.bp_time_logs       enable row level security;
alter table public.bp_activity_log    enable row level security;
alter table public.bp_notifications   enable row level security;
alter table public.bp_invitations     enable row level security;

-- bp_projects
create policy "bp: member can read project"
  on public.bp_projects for select
  using (bp_is_member(id) or owner_id = auth.uid());

create policy "bp: owner can update project"
  on public.bp_projects for update
  using (owner_id = auth.uid());

create policy "bp: authenticated can create project"
  on public.bp_projects for insert
  with check (owner_id = auth.uid());

create policy "bp: owner can delete project"
  on public.bp_projects for delete
  using (owner_id = auth.uid());

-- bp_project_members
create policy "bp: member can read members"
  on public.bp_project_members for select
  using (bp_is_member(project_id));

create policy "bp: owner can manage members"
  on public.bp_project_members for all
  using (bp_is_owner(project_id));

create policy "bp: self can insert when accepting invite"
  on public.bp_project_members for insert
  with check (profile_id = auth.uid());

-- bp_areas
create policy "bp: member can read areas"
  on public.bp_areas for select
  using (bp_is_member(project_id));

create policy "bp: contributor can manage areas"
  on public.bp_areas for all
  using (bp_can_edit(project_id));

-- bp_tasks
create policy "bp: member can read tasks"
  on public.bp_tasks for select
  using (bp_is_member(project_id));

create policy "bp: contributor can manage tasks"
  on public.bp_tasks for all
  using (bp_can_edit(project_id));

-- bp_time_logs
create policy "bp: member can read time logs"
  on public.bp_time_logs for select
  using (bp_is_member((select project_id from public.bp_tasks where id = task_id)));

create policy "bp: contributor can insert time log"
  on public.bp_time_logs for insert
  with check (profile_id = auth.uid()
    and bp_can_edit((select project_id from public.bp_tasks where id = task_id)));

create policy "bp: owner of log can update/delete"
  on public.bp_time_logs for delete
  using (profile_id = auth.uid());

-- bp_activity_log
create policy "bp: member can read activity"
  on public.bp_activity_log for select
  using (bp_is_member(project_id));

create policy "bp: system insert only (service role)"
  on public.bp_activity_log for insert
  with check (bp_is_member(project_id));

-- bp_notifications
create policy "bp: own notifications only"
  on public.bp_notifications for all
  using (profile_id = auth.uid());

-- bp_invitations
create policy "bp: owner can create invitation"
  on public.bp_invitations for insert
  with check (invited_by = auth.uid() and bp_is_owner(project_id));

create policy "bp: owner can read invitations"
  on public.bp_invitations for select
  using (invited_by = auth.uid() or bp_is_owner(project_id));

create policy "bp: anyone with token can accept (handled via RPC)"
  on public.bp_invitations for update
  using (true);
