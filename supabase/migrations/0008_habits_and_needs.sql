-- =====================================================================
-- Patch 0008 — Vaner (habits) og Ønsker/Trenger (needs)
--
-- Vaner: gjentakende rutiner som vitamin, p-pille, tannpuss. Brukeren
-- haker av når den er gjort. Statistikk viser streak og fullføringsrate.
--
-- Ønsker/Trenger: barn kan flagge ting de trenger (mat, hygiene, sko,
-- klær). De kan velge HVEM (foreldre/admin) som skal se ønsket — nyttig
-- for delte hjem.
-- =====================================================================

-- HABITS -------------------------------------------------------------
create type habit_frequency as enum ('daily', 'weekly', 'monthly', 'custom_days');

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  emoji text default '✅',
  color_hex text,
  frequency habit_frequency not null default 'daily',
  frequency_value int default 1,        -- "every N days/weeks/months"
  target_per_period int default 1,      -- f.eks. 2 for vitamin morgen+kveld
  reminder_minutes_after_midnight int,  -- minutter etter midnatt for valgfri push
  is_active boolean default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index idx_habits_profile on public.habits (profile_id, is_active);
create index idx_habits_group on public.habits (group_id, is_active);

create table public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  completed_for_date date not null default current_date, -- hvilken kalenderdag dette teller for
  note text,
  completed_by uuid references public.profiles(id),      -- forelder kan logge for barn
  created_at timestamptz default now()
);
create index idx_hc_habit_date on public.habit_completions (habit_id, completed_for_date desc);
create index idx_hc_profile_date on public.habit_completions (profile_id, completed_for_date desc);

alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;

create policy "habits_member_read" on public.habits
  for select using (public.is_group_member(group_id));

create policy "habits_self_or_admin_write" on public.habits
  for all using (
    profile_id = auth.uid() or public.is_group_admin(group_id)
  ) with check (
    profile_id = auth.uid() or public.is_group_admin(group_id)
  );

create policy "hc_member_read" on public.habit_completions
  for select using (
    exists (
      select 1 from public.habits h
      where h.id = habit_completions.habit_id
        and public.is_group_member(h.group_id)
    )
  );

create policy "hc_self_or_admin_write" on public.habit_completions
  for all using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.habits h
      where h.id = habit_completions.habit_id
        and public.is_group_admin(h.group_id)
    )
  ) with check (
    profile_id = auth.uid()
    or exists (
      select 1 from public.habits h
      where h.id = habit_completions.habit_id
        and public.is_group_admin(h.group_id)
    )
  );

-- Statistikk-funksjoner ----------------------------------------------

-- Hvor mange ganger har vanen blitt fullført i dag?
create or replace function public.habit_today_count(p_habit uuid)
returns int
language sql security invoker stable as $$
  select count(*)::int from public.habit_completions
  where habit_id = p_habit and completed_for_date = current_date;
$$;

-- Streak: antall dager på rad fra og med i dag (eller i går hvis i dag ikke er fullført)
create or replace function public.habit_streak(p_habit uuid)
returns int
language plpgsql security invoker stable as $$
declare
  v_target int;
  v_streak int := 0;
  v_check date;
  v_count int;
begin
  select target_per_period into v_target from public.habits where id = p_habit;
  if v_target is null then v_target := 1; end if;

  -- Begynn fra i dag eller i går
  v_check := current_date;
  -- Hvis i dag ikke er fullført ennå, start streak fra gårsdag
  select count(*) into v_count from public.habit_completions
    where habit_id = p_habit and completed_for_date = v_check;
  if v_count < v_target then
    v_check := v_check - 1;
  end if;

  loop
    select count(*) into v_count from public.habit_completions
      where habit_id = p_habit and completed_for_date = v_check;
    exit when v_count < v_target;
    v_streak := v_streak + 1;
    v_check := v_check - 1;
    -- Sikkerhetsbrems
    if v_streak > 3650 then exit; end if;
  end loop;

  return v_streak;
end;
$$;

-- Siste 30 dagers fullføringsrate (0–100)
create or replace function public.habit_30day_rate(p_habit uuid)
returns int
language plpgsql security invoker stable as $$
declare
  v_target int;
  v_days int := 30;
  v_completed int := 0;
  v_check date;
  v_count int;
begin
  select target_per_period into v_target from public.habits where id = p_habit;
  if v_target is null then v_target := 1; end if;

  for v_check in select generate_series(current_date - 29, current_date, '1 day'::interval)::date loop
    select count(*) into v_count from public.habit_completions
      where habit_id = p_habit and completed_for_date = v_check;
    if v_count >= v_target then v_completed := v_completed + 1; end if;
  end loop;

  return round(v_completed::numeric / v_days * 100)::int;
end;
$$;

-- Slå sammen vaner med statistikk i én spørring (raskere)
create or replace function public.habits_with_stats(p_group uuid, p_profile uuid default null)
returns table (
  id uuid, profile_id uuid, title text, description text, emoji text, color_hex text,
  frequency habit_frequency, frequency_value int, target_per_period int,
  is_active boolean,
  today_count int, streak int, rate_30d int,
  created_at timestamptz
)
language sql security invoker stable as $$
  select
    h.id, h.profile_id, h.title, h.description, h.emoji, h.color_hex,
    h.frequency, h.frequency_value, h.target_per_period, h.is_active,
    public.habit_today_count(h.id) as today_count,
    public.habit_streak(h.id) as streak,
    public.habit_30day_rate(h.id) as rate_30d,
    h.created_at
  from public.habits h
  where h.group_id = p_group
    and h.deleted_at is null
    and h.is_active = true
    and (p_profile is null or h.profile_id = p_profile);
$$;

grant execute on function public.habit_today_count(uuid) to authenticated;
grant execute on function public.habit_streak(uuid) to authenticated;
grant execute on function public.habit_30day_rate(uuid) to authenticated;
grant execute on function public.habits_with_stats(uuid, uuid) to authenticated;

-- NEEDS (Ønsker/Trenger) ---------------------------------------------
create type need_status as enum ('open', 'in_progress', 'fulfilled', 'cancelled');
create type need_priority as enum ('low', 'normal', 'high');

create table public.needs (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  category text,                          -- 'mat','hygiene','klær','sko','annet'
  priority need_priority default 'normal',
  status need_status default 'open',
  visible_to uuid[] not null default '{}',-- tomt array = synlig for alle voksne
  location_note text,                     -- f.eks. "hos pappa", "begge steder"
  fulfilled_at timestamptz,
  fulfilled_by uuid references public.profiles(id),
  fulfilled_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_needs_group_status on public.needs (group_id, status);
create index idx_needs_visible on public.needs using gin (visible_to);

alter table public.needs enable row level security;

-- Lese-policy: ber-bruker, mottakere, eller admin
create policy "needs_read" on public.needs
  for select using (
    requested_by = auth.uid()
    or auth.uid() = any (visible_to)
    or (cardinality(visible_to) = 0 and public.is_group_admin(group_id))
    or public.is_group_admin(group_id)
  );

-- Innsetting: kun grupp-medlem
create policy "needs_insert" on public.needs
  for insert with check (
    public.is_group_member(group_id) and requested_by = auth.uid()
  );

-- Oppdatering: ber-bruker eller admin
create policy "needs_update" on public.needs
  for update using (
    requested_by = auth.uid() or public.is_group_admin(group_id)
  );

-- Sletting: kun admin
create policy "needs_delete" on public.needs
  for delete using (public.is_group_admin(group_id));

-- updated_at-trigger
drop trigger if exists trg_needs_updated on public.needs;
create trigger trg_needs_updated
  before update on public.needs
  for each row execute function public.set_updated_at();

drop trigger if exists trg_habits_updated on public.habits;
create trigger trg_habits_updated
  before update on public.habits
  for each row execute function public.set_updated_at();
