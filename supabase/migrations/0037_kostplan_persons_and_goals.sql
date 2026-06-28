-- =====================================================================
-- KostPlan v2 — Person-profiler, samarbeid og helsemål
-- =====================================================================

-- ─── HELSEMÅL-ENUM ────────────────────────────────────────────────────
create type kp_health_goal as enum (
  'general',            -- Generelt sunt kosthold
  'weight_loss',        -- Vektreduksjon
  'weight_gain',        -- Vektøkning
  'anxiety_reduction',  -- Angstreduserende kost
  'anti_inflammatory',  -- Betennelsesdempende
  'gut_health',         -- Tarmhelse / IBS-vennlig
  'blood_sugar',        -- Blodsukkerstabilisering / diabetes-vennlig
  'heart_health',       -- Hjertehelse
  'energy',             -- Energi og utholdenhet
  'muscle_building',    -- Muskelbygging / styrke
  'adhd_focus',         -- Konsentrasjon / ADHD-støtte
  'sleep',              -- Søvnforbedring
  'immune_support',     -- Immunforsvar
  'bone_health',        -- Skjeletthelse / kalsium
  'sports_performance'  -- Idrettsernæring
);

-- ─── KP_PERSONS ───────────────────────────────────────────────────────
-- "Hvem er kostplanen for?" — kan være et familiemedlem eller en ekstern
create table public.kp_persons (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid not null references public.profiles(id) on delete cascade,
  -- Kobling til eksisterende familieprofil (valgfritt)
  linked_profile_id uuid references public.profiles(id) on delete set null,
  name            text not null,
  birth_date      date,
  color_hex       text default '#3B7DD8',
  avatar_emoji    text default '🧑',
  health_goal     kp_health_goal not null default 'general',
  health_notes    text,  -- f.eks. "diagnostisert med angst, unngå koffein"
  -- Matpreferanser per person
  likes           text[]  default '{}',
  dislikes        text[]  default '{}',
  allergies       text[]  default '{}',
  pickiness_level int     default 3 check (pickiness_level between 1 and 5),
  nutrition_focus kp_nutrition_focus[] default '{}',
  household_size  int     default 1,  -- Antall porsjoner for denne personen
  lunchbox_friendly boolean default false,
  budget_level    text    default 'medium' check (budget_level in ('budget', 'medium', 'premium')),
  notes           text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index idx_kp_persons_created_by on public.kp_persons (created_by);
create index idx_kp_persons_linked on public.kp_persons (linked_profile_id);

-- ─── KP_PERSON_COLLABORATORS ──────────────────────────────────────────
-- Hvem kan administrere denne personens kostplan
create table public.kp_person_collaborators (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references public.kp_persons(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  added_at   timestamptz default now(),
  unique (person_id, profile_id)
);
create index idx_kp_pc_person  on public.kp_person_collaborators (person_id);
create index idx_kp_pc_profile on public.kp_person_collaborators (profile_id);

-- ─── OPPDATER KP_WEEK_PLANS ───────────────────────────────────────────
-- Legg til person_id slik at ukeplaner knyttes til en bestemt person
alter table public.kp_week_plans
  add column if not exists person_id uuid references public.kp_persons(id) on delete cascade;

-- Oppdater unique constraint: én ukeplan per person per uke
alter table public.kp_week_plans
  drop constraint if exists kp_week_plans_profile_id_week_start_key;

create unique index if not exists kp_week_plans_person_week_unique
  on public.kp_week_plans (person_id, week_start)
  where person_id is not null;

-- ─── KP_SHOPPING_LIST ─────────────────────────────────────────────────
-- Handleliste generert fra ukesplan
create table public.kp_shopping_items (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references public.kp_persons(id) on delete cascade,
  week_start  date not null,
  ingredient  text not null,
  quantity    text,    -- f.eks. "400g", "2 stk"
  category    text,    -- f.eks. "Kjøtt", "Grønnsaker", "Meieri"
  checked     boolean default false,
  source_slot_id uuid references public.kp_meal_slots(id) on delete set null,
  created_at  timestamptz default now()
);
create index idx_kp_shop_person on public.kp_shopping_items (person_id, week_start);

-- ─── UPDATED_AT TRIGGER ───────────────────────────────────────────────
create trigger trg_kp_persons_updated
  before update on public.kp_persons
  for each row execute function kp_set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────
alter table public.kp_persons               enable row level security;
alter table public.kp_person_collaborators  enable row level security;
alter table public.kp_shopping_items        enable row level security;

-- Helper: kan denne brukeren se/redigere denne personen?
create or replace function kp_can_access_person(p_person_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.kp_person_collaborators
    where person_id = p_person_id
      and profile_id = auth.uid()
  ) or exists (
    select 1 from public.kp_persons
    where id = p_person_id and created_by = auth.uid()
  )
$$;

create or replace function kp_can_edit_person(p_person_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.kp_person_collaborators
    where person_id = p_person_id
      and profile_id = auth.uid()
      and role in ('owner', 'editor')
  ) or exists (
    select 1 from public.kp_persons
    where id = p_person_id and created_by = auth.uid()
  )
$$;

-- kp_persons
create policy "kp: se egne og delte personer"
  on public.kp_persons for select
  using (kp_can_access_person(id));

create policy "kp: opprett person"
  on public.kp_persons for insert
  with check (created_by = auth.uid());

create policy "kp: rediger person"
  on public.kp_persons for update
  using (kp_can_edit_person(id));

create policy "kp: slett person (kun eier)"
  on public.kp_persons for delete
  using (created_by = auth.uid());

-- kp_person_collaborators
create policy "kp: se samarbeidspartnere"
  on public.kp_person_collaborators for select
  using (kp_can_access_person(person_id));

create policy "kp: legg til samarbeidspartner (eier)"
  on public.kp_person_collaborators for insert
  with check (kp_can_edit_person(person_id));

create policy "kp: fjern samarbeidspartner (eier)"
  on public.kp_person_collaborators for delete
  using (kp_can_edit_person(person_id));

-- kp_week_plans: oppdater policy til å dekke person-baserte planer
drop policy if exists "kp: own week plans" on public.kp_week_plans;
create policy "kp: own week plans"
  on public.kp_week_plans for all
  using (
    profile_id = auth.uid()
    or (person_id is not null and kp_can_access_person(person_id))
  )
  with check (
    profile_id = auth.uid()
    or (person_id is not null and kp_can_edit_person(person_id))
  );

-- kp_shopping_items
create policy "kp: shopping list access"
  on public.kp_shopping_items for all
  using (kp_can_access_person(person_id));

-- ─── FUNKSJON: Auto-opprett samarbeidspartner ved person-opprettelse ───
create or replace function kp_after_person_insert()
returns trigger language plpgsql security definer as $$
begin
  insert into public.kp_person_collaborators (person_id, profile_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end; $$;

create trigger trg_kp_person_owner
  after insert on public.kp_persons
  for each row execute function kp_after_person_insert();
