-- =====================================================================
-- Patch 0010 — Gjøremål V2: flere tildelte, perioder og ikoner
--
-- Datamodell:
--   chores.assignee_ids[]   = hvilke profiler som ser/kan plukke oppgaven.
--                             Tom array = "alle i gruppen" (gammel pool-oppførsel).
--   chores.period_kind      = once | daily | weekly | monthly | custom_days
--   chores.period_reset_*   = når en ny periode begynner (uke/måned/dag-grense)
--   chores.icon             = emoji-ikon for visuell gjenkjennelse
--
--   chore_assignments.period_key   = unik ID for perioden (f.eks. "W:2026-05-04")
--                                    UNIQUE per chore — sikrer maks én aktiv
--                                    assignment per periode.
--
-- Logikk:
--   Når noen åpner /gjoremal kjøres ensure_group_period_assignments(group)
--   som lager en ny rad per chore for inneværende periode hvis den mangler.
--   Når en av tildelte hakker av oppgaven, settes assigned_to = den brukeren,
--   og oppgaven forsvinner fra de andres pool i samme periode.
-- =====================================================================

create type chore_period_kind as enum ('once', 'daily', 'weekly', 'monthly', 'custom_days');

alter table public.chores
  add column if not exists assignee_ids uuid[] default '{}',
  add column if not exists period_kind chore_period_kind default 'once',
  add column if not exists period_reset_hour int default 0 check (period_reset_hour between 0 and 23),
  add column if not exists period_reset_weekday int default 1 check (period_reset_weekday between 1 and 7),
  add column if not exists period_reset_day_of_month int default 1 check (period_reset_day_of_month between 1 and 31),
  add column if not exists period_interval_days int default 1 check (period_interval_days between 1 and 365),
  add column if not exists icon text default '✅';

-- Backfill: kopier default_assignee_id til assignee_ids hvis sistnevnte er tomt
update public.chores
   set assignee_ids = array[default_assignee_id]::uuid[]
 where (assignee_ids is null or cardinality(assignee_ids) = 0)
   and default_assignee_id is not null;

-- Backfill periode-typen ut fra eksisterende RRULE
update public.chores set period_kind = 'weekly'
  where recurrence_rule like '%FREQ=WEEKLY%' and period_kind = 'once';
update public.chores set period_kind = 'daily'
  where recurrence_rule like '%FREQ=DAILY%' and period_kind = 'once';
update public.chores set period_kind = 'monthly'
  where recurrence_rule like '%FREQ=MONTHLY%' and period_kind = 'once';

-- Indeks for hurtig "hvilke gjøremål kan jeg se?"
create index if not exists idx_chores_assignees on public.chores using gin (assignee_ids);

-- chore_assignments — period_key + unique
alter table public.chore_assignments
  add column if not exists period_key text;

create unique index if not exists chore_assignments_chore_period_unique
  on public.chore_assignments (chore_id, period_key)
  where period_key is not null;

-- ----- Periode-funksjoner -------------------------------------------------

create or replace function public.chore_period_key(p_chore uuid, p_at timestamptz default now())
returns text
language plpgsql security invoker stable
as $$
declare
  c record;
  v_local timestamp;
  v_date date;
  v_dow int;
  v_offset int;
  v_week_start date;
  v_year int;
  v_month int;
  v_day int;
begin
  select period_kind, period_reset_hour, period_reset_weekday,
         period_reset_day_of_month, period_interval_days
  into c from public.chores where id = p_chore;
  if c.period_kind is null then return null; end if;

  -- Trekk fra reset-time så starten av en periode er kl 00:00
  v_local := (p_at at time zone 'Europe/Oslo') - make_interval(hours => c.period_reset_hour);
  v_date := v_local::date;

  if c.period_kind = 'once' then
    return null;
  elsif c.period_kind = 'daily' then
    return 'D:' || to_char(v_date, 'YYYY-MM-DD');
  elsif c.period_kind = 'weekly' then
    v_dow := extract(isodow from v_date)::int;
    v_offset := (v_dow - c.period_reset_weekday + 7) % 7;
    v_week_start := v_date - v_offset;
    return 'W:' || to_char(v_week_start, 'YYYY-MM-DD');
  elsif c.period_kind = 'monthly' then
    v_year := extract(year from v_date)::int;
    v_month := extract(month from v_date)::int;
    v_day := extract(day from v_date)::int;
    if v_day < c.period_reset_day_of_month then
      v_month := v_month - 1;
      if v_month = 0 then v_month := 12; v_year := v_year - 1; end if;
    end if;
    return 'M:' || lpad(v_year::text, 4, '0') || '-' || lpad(v_month::text, 2, '0');
  elsif c.period_kind = 'custom_days' then
    return 'C:' || (extract(epoch from v_date::timestamp)::bigint / (c.period_interval_days * 86400))::text;
  end if;
  return null;
end;
$$;

create or replace function public.ensure_chore_period_assignment(p_chore uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  c record;
  v_key text;
  v_id uuid;
begin
  select id, group_id, period_kind into c
  from public.chores
  where id = p_chore and deleted_at is null;
  if c.id is null then return null; end if;
  if c.period_kind = 'once' then return null; end if;

  v_key := public.chore_period_key(p_chore, now());
  if v_key is null then return null; end if;

  select id into v_id from public.chore_assignments
   where chore_id = p_chore and period_key = v_key
   limit 1;
  if v_id is not null then return v_id; end if;

  insert into public.chore_assignments (chore_id, group_id, period_key, status, assigned_to)
  values (p_chore, c.group_id, v_key, 'available', null)
  on conflict do nothing
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.ensure_group_period_assignments(p_group uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  rec record;
begin
  if not public.is_group_member(p_group) then return; end if;
  for rec in
    select id from public.chores
    where group_id = p_group
      and deleted_at is null
      and period_kind <> 'once'
  loop
    perform public.ensure_chore_period_assignment(rec.id);
  end loop;
end;
$$;

grant execute on function public.chore_period_key(uuid, timestamptz) to authenticated;
grant execute on function public.ensure_chore_period_assignment(uuid) to authenticated;
grant execute on function public.ensure_group_period_assignments(uuid) to authenticated;
