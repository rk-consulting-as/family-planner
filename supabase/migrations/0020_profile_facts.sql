-- =====================================================================
-- Patch 0020 — Medlems-info (profile_facts)
--
-- Fleksible felt-info per medlem som ofte glemmes: skostørrelse, allergier,
-- klær, klassekontakt, viktige datoer osv.
-- Synlighet kan settes til "alle medlemmer" eller "kun admin/foreldre".
-- =====================================================================

create type fact_visibility as enum ('group', 'admins_only', 'self_only');

create table if not exists public.profile_facts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  category text not null default 'general',
  label text not null,
  value text,
  icon text default '📝',
  visibility fact_visibility not null default 'group',
  sort_order int default 0,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_pf_group_profile on public.profile_facts (group_id, profile_id);
create index if not exists idx_pf_category on public.profile_facts (group_id, profile_id, category);

drop trigger if exists trg_pf_updated on public.profile_facts;
create trigger trg_pf_updated before update on public.profile_facts
  for each row execute function public.set_updated_at();

alter table public.profile_facts enable row level security;

drop policy if exists "pf_read" on public.profile_facts;
create policy "pf_read" on public.profile_facts
  for select using (
    public.is_group_member(group_id) and (
      visibility = 'group'
      or (visibility = 'admins_only' and (public.is_group_admin(group_id) or profile_id = auth.uid()))
      or (visibility = 'self_only' and (profile_id = auth.uid() or public.is_group_admin(group_id)))
    )
  );

drop policy if exists "pf_self_or_admin_write" on public.profile_facts;
create policy "pf_self_or_admin_write" on public.profile_facts
  for all using (
    profile_id = auth.uid() or public.is_group_admin(group_id)
  ) with check (
    profile_id = auth.uid() or public.is_group_admin(group_id)
  );
