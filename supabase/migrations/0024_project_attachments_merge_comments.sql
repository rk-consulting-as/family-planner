-- =====================================================================
-- Patch 0024 — Vedlegg-lagring, kilde-link, sammenslåing av parter,
-- kommentarer på milestones.
-- =====================================================================

-- 1) Vedlegg-lagring på dokumenter
alter table public.project_documents
  add column if not exists storage_path text,
  add column if not exists public_url text,
  add column if not exists mime_type text,
  add column if not exists size_bytes int;

-- 2) Knytt milestone til kildedokument
alter table public.project_milestones
  add column if not exists source_document_id uuid references public.project_documents(id) on delete set null;
create index if not exists idx_pm_source_doc on public.project_milestones (source_document_id);

-- 3) Slå sammen parter (behold raden, marker som merged)
alter table public.project_parties
  add column if not exists merged_into_id uuid references public.project_parties(id) on delete set null;
create index if not exists idx_pp_merged on public.project_parties (merged_into_id);

-- View som filtrerer ut sammenslåtte
drop view if exists public.project_parties_active;
create view public.project_parties_active
with (security_invoker = on)
as
select * from public.project_parties where merged_into_id is null;

grant select on public.project_parties_active to authenticated;

-- 4) Kommentarer på milestones
create table if not exists public.project_milestone_comments (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.project_milestones(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index if not exists idx_pmc_ms on public.project_milestone_comments (milestone_id, created_at);

drop trigger if exists trg_pmc_upd on public.project_milestone_comments;
create trigger trg_pmc_upd before update on public.project_milestone_comments
  for each row execute function public.set_updated_at();

alter table public.project_milestone_comments enable row level security;

drop policy if exists "pmc_member_read" on public.project_milestone_comments;
create policy "pmc_member_read" on public.project_milestone_comments
  for select using (public.is_project_member(project_id));

drop policy if exists "pmc_member_insert" on public.project_milestone_comments;
create policy "pmc_member_insert" on public.project_milestone_comments
  for insert with check (
    author_id = auth.uid() and public.is_project_member(project_id)
  );

drop policy if exists "pmc_self_or_lead_delete" on public.project_milestone_comments;
create policy "pmc_self_or_lead_delete" on public.project_milestone_comments
  for delete using (
    author_id = auth.uid() or public.is_project_member(project_id)
  );

-- 5) RPCs for merge/unmerge
create or replace function public.merge_parties(
  p_project uuid, p_canonical uuid, p_to_merge uuid[]
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_project_member(p_project) then
    raise exception 'Mangler tilgang';
  end if;

  -- Pek alle milestones som referer de som slås sammen til canonical
  update public.project_milestones
    set responsible_party_id = p_canonical
    where project_id = p_project
      and responsible_party_id = any(p_to_merge);

  -- Marker som merged
  update public.project_parties
    set merged_into_id = p_canonical
    where id = any(p_to_merge)
      and id <> p_canonical
      and project_id = p_project;
end;
$$;

grant execute on function public.merge_parties(uuid, uuid, uuid[]) to authenticated;

create or replace function public.unmerge_party(p_party uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_proj uuid;
begin
  select project_id into v_proj from public.project_parties where id = p_party;
  if v_proj is null then raise exception 'Finnes ikke'; end if;
  if not public.is_project_member(v_proj) then
    raise exception 'Mangler tilgang';
  end if;
  update public.project_parties set merged_into_id = null where id = p_party;
end;
$$;

grant execute on function public.unmerge_party(uuid) to authenticated;
