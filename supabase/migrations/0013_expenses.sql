-- =====================================================================
-- Patch 0013 — Felles utlegg / regnskap mellom familien
--
-- Datamodell:
--   expense_periods   = ett "regnskap" — har status open/closed.
--                        Når åpen kan man legge til utlegg. Når lukket:
--                        låst, en ny åpen periode opprettes automatisk.
--   expenses          = enkelt-utlegg. Knyttes til den aktive perioden.
--                        Lagrer hvem som betalte, beløp, hvordan deles.
--   expense_attachments = kvitteringer (bilder/PDF i storage)
--   expense_comments    = chat/kommentarer på utlegg
--
-- Splitt-typer:
--   'equal'         — likt mellom alle i split_with
--   'only_paid_by'  — kun en som "skal" — vises bare som info, ingen skal betale
--   'custom'        — split_custom: {profile_id: prosent (0-100)}
-- =====================================================================

create type expense_split_kind as enum ('equal', 'only_paid_by', 'custom');
create type expense_period_status as enum ('open', 'closed');

create table if not exists public.expense_periods (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,                       -- f.eks. "Mai 2026"
  started_on date not null default current_date,
  closed_on date,
  status expense_period_status not null default 'open',
  settled_summary jsonb,                    -- snapshot ved closing
  closed_by uuid references public.profiles(id),
  closed_note text,
  created_at timestamptz default now()
);
create index if not exists idx_ep_group_status on public.expense_periods (group_id, status);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  period_id uuid not null references public.expense_periods(id) on delete cascade,
  paid_by uuid not null references public.profiles(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  currency text default 'NOK',
  description text not null,
  category text,                            -- 'klær','sport','helse','skole','mat','annet'
  expense_date date not null default current_date,
  split_kind expense_split_kind not null default 'equal',
  split_with uuid[] not null default '{}',  -- profil-IDer involvert i delingen
  split_custom jsonb,                       -- kun for 'custom': {profile_id: prosent}
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index if not exists idx_exp_period on public.expenses (period_id);
create index if not exists idx_exp_group_date on public.expenses (group_id, expense_date desc);
create index if not exists idx_exp_paid_by on public.expenses (paid_by);

create table if not exists public.expense_attachments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  storage_path text not null,
  public_url text not null,
  filename text,
  mime_type text,
  size_bytes int,
  created_at timestamptz default now()
);
create index if not exists idx_ea_expense on public.expense_attachments (expense_id);

create table if not exists public.expense_comments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  author_id uuid references public.profiles(id),
  body text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index if not exists idx_ec_expense on public.expense_comments (expense_id, created_at);

-- updated_at-triggere
drop trigger if exists trg_exp_updated on public.expenses;
create trigger trg_exp_updated before update on public.expenses
  for each row execute function public.set_updated_at();

drop trigger if exists trg_ec_updated on public.expense_comments;
create trigger trg_ec_updated before update on public.expense_comments
  for each row execute function public.set_updated_at();

-- RLS -----------------------------------------------------------------
alter table public.expense_periods enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_attachments enable row level security;
alter table public.expense_comments enable row level security;

drop policy if exists "ep_member_read" on public.expense_periods;
create policy "ep_member_read" on public.expense_periods
  for select using (public.is_group_member(group_id));

drop policy if exists "ep_admin_write" on public.expense_periods;
create policy "ep_admin_write" on public.expense_periods
  for all using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

drop policy if exists "exp_member_read" on public.expenses;
create policy "exp_member_read" on public.expenses
  for select using (public.is_group_member(group_id));

drop policy if exists "exp_member_write" on public.expenses;
create policy "exp_member_write" on public.expenses
  for all using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

drop policy if exists "ea_read" on public.expense_attachments;
create policy "ea_read" on public.expense_attachments
  for select using (
    exists(
      select 1 from public.expenses e
      where e.id = expense_attachments.expense_id
        and public.is_group_member(e.group_id)
    )
  );

drop policy if exists "ea_insert" on public.expense_attachments;
create policy "ea_insert" on public.expense_attachments
  for insert with check (
    uploaded_by = auth.uid() and
    exists(
      select 1 from public.expenses e
      where e.id = expense_attachments.expense_id
        and public.is_group_member(e.group_id)
    )
  );

drop policy if exists "ea_delete" on public.expense_attachments;
create policy "ea_delete" on public.expense_attachments
  for delete using (
    uploaded_by = auth.uid()
    or exists(
      select 1 from public.expenses e
      where e.id = expense_attachments.expense_id and public.is_group_admin(e.group_id)
    )
  );

drop policy if exists "ec_read" on public.expense_comments;
create policy "ec_read" on public.expense_comments
  for select using (
    exists(
      select 1 from public.expenses e
      where e.id = expense_comments.expense_id
        and public.is_group_member(e.group_id)
    )
  );

drop policy if exists "ec_insert" on public.expense_comments;
create policy "ec_insert" on public.expense_comments
  for insert with check (
    author_id = auth.uid() and
    exists(
      select 1 from public.expenses e
      where e.id = expense_comments.expense_id
        and public.is_group_member(e.group_id)
    )
  );

drop policy if exists "ec_delete_own" on public.expense_comments;
create policy "ec_delete_own" on public.expense_comments
  for delete using (
    author_id = auth.uid()
    or exists(
      select 1 from public.expenses e
      where e.id = expense_comments.expense_id and public.is_group_admin(e.group_id)
    )
  );

-- ----- Helper functions ------------------------------------------------

-- Hent eller opprett aktiv periode for gruppen
create or replace function public.get_or_create_open_period(p_group uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
begin
  if not public.is_group_member(p_group) then
    raise exception 'Mangler tilgang';
  end if;

  select id into v_id from public.expense_periods
    where group_id = p_group and status = 'open'
    order by started_on desc limit 1;
  if v_id is not null then return v_id; end if;

  v_name := to_char(current_date, 'TMMonth YYYY');
  insert into public.expense_periods (group_id, name, started_on, status)
    values (p_group, initcap(v_name), current_date, 'open')
    returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.get_or_create_open_period(uuid) to authenticated;

-- Saldo per profil for en periode
-- Returnerer: hver person sin "netto saldo" — positivt tall = de andre skylder deg,
-- negativt tall = du skylder. Summert over alle utlegg i perioden.
create or replace function public.expense_period_balances(p_period uuid)
returns table (profile_id uuid, paid numeric, owes numeric, net numeric)
language plpgsql security invoker stable
as $$
begin
  return query
  with all_profiles as (
    select distinct unnest(
      array[paid_by] || coalesce(split_with, '{}'::uuid[]) ||
      coalesce(array(select jsonb_object_keys(split_custom)::uuid), '{}'::uuid[])
    ) as pid
    from public.expenses
    where period_id = p_period and deleted_at is null
  ),
  paid_per as (
    select paid_by as pid, sum(amount)::numeric as total_paid
    from public.expenses
    where period_id = p_period and deleted_at is null
    group by paid_by
  ),
  owes_calc as (
    select
      ap.pid,
      coalesce(sum(
        case e.split_kind
          when 'only_paid_by' then 0
          when 'equal' then
            case when ap.pid = any(e.split_with) and cardinality(e.split_with) > 0
              then e.amount / cardinality(e.split_with)
              else 0
            end
          when 'custom' then
            coalesce((e.split_custom->>(ap.pid::text))::numeric, 0) * e.amount / 100
          else 0
        end
      ), 0)::numeric as total_owes
    from all_profiles ap
    cross join public.expenses e
    where e.period_id = p_period and e.deleted_at is null
    group by ap.pid
  )
  select
    ap.pid,
    coalesce(p.total_paid, 0)::numeric,
    coalesce(o.total_owes, 0)::numeric,
    (coalesce(p.total_paid, 0) - coalesce(o.total_owes, 0))::numeric
  from all_profiles ap
  left join paid_per p on p.pid = ap.pid
  left join owes_calc o on o.pid = ap.pid;
end;
$$;

grant execute on function public.expense_period_balances(uuid) to authenticated;

-- Lukk perioden + opprett ny — en transaksjon
create or replace function public.close_expense_period(
  p_period uuid, p_note text default null
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_period public.expense_periods;
  v_summary jsonb;
  v_new_id uuid;
begin
  select * into v_period from public.expense_periods where id = p_period;
  if v_period.id is null then raise exception 'Periode finnes ikke'; end if;
  if v_period.status <> 'open' then raise exception 'Periode er allerede lukket'; end if;
  if not public.is_group_admin(v_period.group_id) then
    raise exception 'Bare admin kan lukke periode';
  end if;

  -- Bygg sammendrag som JSON
  select jsonb_agg(jsonb_build_object(
    'profile_id', profile_id, 'paid', paid, 'owes', owes, 'net', net
  ))
  into v_summary
  from public.expense_period_balances(p_period);

  update public.expense_periods
    set status = 'closed', closed_on = current_date,
        closed_by = auth.uid(), closed_note = p_note,
        settled_summary = coalesce(v_summary, '[]'::jsonb)
    where id = p_period;

  -- Opprett ny åpen periode
  insert into public.expense_periods (group_id, name, started_on, status)
    values (v_period.group_id,
            initcap(to_char(current_date, 'TMMonth YYYY')),
            current_date, 'open')
    returning id into v_new_id;

  return v_new_id;
end;
$$;

grant execute on function public.close_expense_period(uuid, text) to authenticated;
