-- =====================================================================
-- Kostplan — AI-drevet matplanlegger
-- Prefix: kp_
-- Deler auth.users og profiles med familie-appen.
-- =====================================================================

-- ─── ENUM TYPES ───────────────────────────────────────────────────────
create type kp_meal_type       as enum ('breakfast', 'lunch', 'dinner', 'snack', 'supper');
create type kp_nutrition_focus as enum ('iron', 'folate', 'vitamin_d', 'protein', 'fiber', 'calcium', 'omega3');
create type kp_ai_provider     as enum ('openai', 'anthropic');
create type kp_ai_mode         as enum ('suggest_meals', 'replace_ingredient', 'explain_meal', 'weekly_refinement');

-- ─── USER PREFERENCES ─────────────────────────────────────────────────
create table public.kp_preferences (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  likes             text[]  default '{}',
  dislikes          text[]  default '{}',
  allergies         text[]  default '{}',
  pickiness_level   int     default 3 check (pickiness_level between 1 and 5),  -- 1=spiser alt, 5=veldig kresen
  nutrition_focus   kp_nutrition_focus[] default '{}',
  household_size    int     default 4,
  lunchbox_friendly boolean default true,
  language          text    default 'nb',
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (profile_id)
);

-- ─── WEEK PLANS ───────────────────────────────────────────────────────
create table public.kp_week_plans (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,   -- Mandag i uken (ISO week)
  title      text,
  notes      text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (profile_id, week_start)
);
create index idx_kp_wp_profile on public.kp_week_plans (profile_id, week_start desc);

-- ─── DAY PLANS ────────────────────────────────────────────────────────
create table public.kp_day_plans (
  id           uuid primary key default gen_random_uuid(),
  week_plan_id uuid not null references public.kp_week_plans(id) on delete cascade,
  day_of_week  int not null check (day_of_week between 1 and 7),  -- 1=mandag, 7=søndag
  notes        text,
  created_at   timestamptz default now(),
  unique (week_plan_id, day_of_week)
);
create index idx_kp_dp_week on public.kp_day_plans (week_plan_id);

-- ─── MEAL SLOTS ───────────────────────────────────────────────────────
create table public.kp_meal_slots (
  id                   uuid primary key default gen_random_uuid(),
  day_plan_id          uuid not null references public.kp_day_plans(id) on delete cascade,
  meal_type            kp_meal_type not null,
  title                text,
  description          text,
  ingredients          text[] default '{}',
  tags                 text[] default '{}',   -- feks ['easy', 'lunchbox', 'vegetarian']
  prep_minutes         int,
  nutrition_notes      text,
  ai_generated         boolean default false,
  ai_request_id        uuid,   -- ref til kp_ai_requests, set etter insert
  sort_order           int default 0,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);
create index idx_kp_ms_day on public.kp_meal_slots (day_plan_id);

-- ─── FAVORITES ────────────────────────────────────────────────────────
create table public.kp_favorites (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  description text,
  ingredients text[] default '{}',
  tags        text[] default '{}',
  meal_type   kp_meal_type,
  prep_minutes int,
  times_used  int default 0,
  last_used   date,
  created_at  timestamptz default now()
);
create index idx_kp_fav_profile on public.kp_favorites (profile_id);

-- ─── AI REQUESTS ──────────────────────────────────────────────────────
-- Logger alle AI-kall for debugging, kostnadssporing og replay
create table public.kp_ai_requests (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  provider        kp_ai_provider not null,
  mode            kp_ai_mode not null,
  model           text,
  input_json      jsonb not null,
  output_json     jsonb,
  error           text,
  latency_ms      int,
  prompt_tokens   int,
  completion_tokens int,
  created_at      timestamptz default now()
);
create index idx_kp_ai_profile  on public.kp_ai_requests (profile_id, created_at desc);
create index idx_kp_ai_provider on public.kp_ai_requests (provider, created_at desc);

-- Legg til FK etter at begge tabeller er opprettet
alter table public.kp_meal_slots
  add constraint fk_kp_ms_ai_request
  foreign key (ai_request_id) references public.kp_ai_requests(id) on delete set null;

-- ─── UPDATED_AT TRIGGERS ──────────────────────────────────────────────
create or replace function kp_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_kp_prefs_updated
  before update on public.kp_preferences
  for each row execute function kp_set_updated_at();

create trigger trg_kp_wp_updated
  before update on public.kp_week_plans
  for each row execute function kp_set_updated_at();

create trigger trg_kp_ms_updated
  before update on public.kp_meal_slots
  for each row execute function kp_set_updated_at();

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────

alter table public.kp_preferences  enable row level security;
alter table public.kp_week_plans   enable row level security;
alter table public.kp_day_plans    enable row level security;
alter table public.kp_meal_slots   enable row level security;
alter table public.kp_favorites    enable row level security;
alter table public.kp_ai_requests  enable row level security;

-- kp_preferences: kun eier
create policy "kp: own preferences"
  on public.kp_preferences for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- kp_week_plans: kun eier
create policy "kp: own week plans"
  on public.kp_week_plans for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- kp_day_plans: eier av ukeplan
create policy "kp: own day plans"
  on public.kp_day_plans for all
  using (
    exists (
      select 1 from public.kp_week_plans
      where id = week_plan_id and profile_id = auth.uid()
    )
  );

-- kp_meal_slots: eier av ukeplan via day_plan
create policy "kp: own meal slots"
  on public.kp_meal_slots for all
  using (
    exists (
      select 1 from public.kp_day_plans dp
      join public.kp_week_plans wp on wp.id = dp.week_plan_id
      where dp.id = day_plan_id and wp.profile_id = auth.uid()
    )
  );

-- kp_favorites: kun eier
create policy "kp: own favorites"
  on public.kp_favorites for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- kp_ai_requests: kun eier kan lese egne
create policy "kp: own ai requests"
  on public.kp_ai_requests for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ─── SEED: standard preferanser ved registrering ──────────────────────
-- Kall denne RPC etter at brukeren fullfører onboarding
create or replace function kp_init_preferences(
  p_profile_id uuid,
  p_likes text[] default '{}',
  p_dislikes text[] default '{}',
  p_allergies text[] default '{}',
  p_pickiness int default 3,
  p_nutrition_focus kp_nutrition_focus[] default '{}',
  p_household_size int default 4
)
returns void language plpgsql security definer as $$
begin
  insert into public.kp_preferences (
    profile_id, likes, dislikes, allergies,
    pickiness_level, nutrition_focus, household_size
  ) values (
    p_profile_id, p_likes, p_dislikes, p_allergies,
    p_pickiness, p_nutrition_focus, p_household_size
  )
  on conflict (profile_id) do update set
    likes = excluded.likes,
    dislikes = excluded.dislikes,
    allergies = excluded.allergies,
    pickiness_level = excluded.pickiness_level,
    nutrition_focus = excluded.nutrition_focus,
    household_size = excluded.household_size,
    updated_at = now();
end; $$;
