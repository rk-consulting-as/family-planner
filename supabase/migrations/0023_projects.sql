-- =====================================================================
-- Patch 0023 — Prosjekt-modul (sensitiv tidslinje med eksterne instanser)
--
-- Brukstilfelle: langvarige prosesser (utredning, søknader, behandling,
-- juridiske forhold) der man trenger oversikt over:
--   - Tidslinje av hva som har skjedd og skal skje
--   - Eksterne instanser (skole, BUP, NAV, advokat, ...)
--   - Egne ansvarspunkter
--   - Vedlagte dokumenter, eposter, notater
--
-- Sikkerhet: bare eksplisitte prosjekt-medlemmer kan se data. Selv
-- gruppe-admins får IKKE automatisk tilgang — må legges til.
-- =====================================================================

create type project_status as enum ('active', 'paused', 'completed', 'archived');
create type milestone_kind as enum (
  'past_event',     -- noe som har skjedd
  'meeting',        -- møte
  'deadline',       -- frist
  'action_item',    -- noe som må gjøres
  'document',       -- dokument mottatt/sendt
  'decision',       -- beslutning
  'note'            -- merknad
);
create type milestone_status as enum ('planned', 'completed', 'cancelled', 'overdue');

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  description text,
  status project_status not null default 'active',
  started_at date,
  context_subject text,         -- f.eks. navn på personen prosjektet handler om
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index if not exists idx_projects_group on public.projects (group_id) where deleted_at is null;

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('lead', 'member', 'viewer')),
  joined_at timestamptz default now(),
  primary key (project_id, profile_id)
);
create index if not exists idx_pm_profile on public.project_members (profile_id);

create table if not exists public.project_parties (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,                -- "BUP Stavanger", "Lærer Hansen"
  role text,                         -- "Behandler", "Saksbehandler"
  organization text,                 -- "BUP", "Skolen"
  contact_info text,                 -- tlf, epost
  notes text,
  is_internal boolean default false, -- false = ekstern, true = oss selv
  created_at timestamptz default now()
);
create index if not exists idx_pp_project on public.project_parties (project_id);

create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  kind milestone_kind not null default 'past_event',
  status milestone_status not null default 'planned',
  occurred_at timestamptz,                 -- når det skjedde / skal skje
  due_at timestamptz,                      -- frist (for action items)
  responsible_party_id uuid references public.project_parties(id) on delete set null,
  responsible_profile_ids uuid[] default '{}', -- interne ansvarlige (foreldre)
  reminder_days_before int,                -- påminnelse N dager før due_at
  ai_extracted boolean default false,
  ai_source_excerpt text,                  -- hvilken tekst-bit AI brukte
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_pms_project_date on public.project_milestones (project_id, occurred_at desc nulls last);
create index if not exists idx_pms_due on public.project_milestones (project_id, due_at) where due_at is not null;

create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  kind text default 'document' check (kind in ('document', 'email', 'note', 'link', 'pdf', 'image')),
  storage_path text,
  public_url text,
  source_text text,                  -- den faktiske teksten (innlimt)
  source_date date,                  -- dato dokumentet er fra
  ai_summary text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz default now()
);
create index if not exists idx_pd_project on public.project_documents (project_id, created_at desc);

create table if not exists public.project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  body text not null,
  author_id uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_pn_project on public.project_notes (project_id, created_at desc);

-- updated_at-triggers
drop trigger if exists trg_projects_upd on public.projects;
create trigger trg_projects_upd before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists trg_pms_upd on public.project_milestones;
create trigger trg_pms_upd before update on public.project_milestones
  for each row execute function public.set_updated_at();

drop trigger if exists trg_pn_upd on public.project_notes;
create trigger trg_pn_upd before update on public.project_notes
  for each row execute function public.set_updated_at();

-- ----- HELPER ---------------------------------------------------------
create or replace function public.is_project_member(p_project uuid, p_profile uuid default auth.uid())
returns boolean
language sql security definer stable as $$
  select exists(
    select 1 from public.project_members
    where project_id = p_project and profile_id = p_profile
  );
$$;

grant execute on function public.is_project_member(uuid, uuid) to authenticated;

-- ----- RLS ------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.project_parties enable row level security;
alter table public.project_milestones enable row level security;
alter table public.project_documents enable row level security;
alter table public.project_notes enable row level security;

-- Projects: kun medlemmer
drop policy if exists "proj_member_read" on public.projects;
create policy "proj_member_read" on public.projects
  for select using (
    public.is_project_member(id) or created_by = auth.uid()
  );

drop policy if exists "proj_create" on public.projects;
create policy "proj_create" on public.projects
  for insert with check (
    public.is_group_member(group_id) and created_by = auth.uid()
  );

drop policy if exists "proj_member_update" on public.projects;
create policy "proj_member_update" on public.projects
  for update using (public.is_project_member(id))
  with check (public.is_project_member(id));

drop policy if exists "proj_creator_delete" on public.projects;
create policy "proj_creator_delete" on public.projects
  for delete using (created_by = auth.uid());

-- project_members
drop policy if exists "pm_member_read" on public.project_members;
create policy "pm_member_read" on public.project_members
  for select using (
    public.is_project_member(project_id) or profile_id = auth.uid()
  );

drop policy if exists "pm_member_insert" on public.project_members;
create policy "pm_member_insert" on public.project_members
  for insert with check (
    -- Du kan legge deg selv til (creator-flow) eller du er allerede medlem
    profile_id = auth.uid() or public.is_project_member(project_id)
  );

drop policy if exists "pm_self_or_lead_delete" on public.project_members;
create policy "pm_self_or_lead_delete" on public.project_members
  for delete using (
    profile_id = auth.uid() or public.is_project_member(project_id)
  );

-- Resten: kun project members
drop policy if exists "pp_member_all" on public.project_parties;
create policy "pp_member_all" on public.project_parties
  for all using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists "pms_member_all" on public.project_milestones;
create policy "pms_member_all" on public.project_milestones
  for all using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists "pd_member_all" on public.project_documents;
create policy "pd_member_all" on public.project_documents
  for all using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists "pn_member_all" on public.project_notes;
create policy "pn_member_all" on public.project_notes
  for all using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

-- Auto-add creator som lead
create or replace function public.add_project_creator()
returns trigger language plpgsql security definer as $$
begin
  insert into public.project_members (project_id, profile_id, role)
  values (NEW.id, NEW.created_by, 'lead')
  on conflict (project_id, profile_id) do nothing;
  return NEW;
end;
$$;

drop trigger if exists trg_add_proj_creator on public.projects;
create trigger trg_add_proj_creator
  after insert on public.projects
  for each row execute function public.add_project_creator();
