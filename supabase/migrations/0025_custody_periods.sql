-- =====================================================================
-- Patch 0025 — Bostedsplan (hvor barna er)
--
-- Lar deg sette opp perioder hvor barna er hos en bestemt forelder.
-- Vises som faint farget bakgrunnsstripe i kalender med "Hos pappa" /
-- "Hos mamma"-tekst.
-- =====================================================================

create table if not exists public.custody_periods (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  host_parent_id uuid not null references public.profiles(id) on delete cascade,
  child_ids uuid[] not null default '{}',
  starts_on date not null,
  ends_on date not null,
  label text,                                -- f.eks. "Hos pappa" — auto hvis null
  color_hex text default '#3b82f6',
  opacity numeric(3, 2) default 0.15 check (opacity between 0.05 and 0.5),
  notes text,
  recurrence_rule text,                      -- RRULE for fremtidige varianter
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_cp_group_dates on public.custody_periods (group_id, starts_on, ends_on);

drop trigger if exists trg_cp_upd on public.custody_periods;
create trigger trg_cp_upd before update on public.custody_periods
  for each row execute function public.set_updated_at();

alter table public.custody_periods enable row level security;

drop policy if exists "cp_member_read" on public.custody_periods;
create policy "cp_member_read" on public.custody_periods
  for select using (public.is_group_member(group_id));

drop policy if exists "cp_admin_write" on public.custody_periods;
create policy "cp_admin_write" on public.custody_periods
  for all using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));
