-- =====================================================================
-- Patch 0009 — Profil V2 + endringsforespørsler + storage for avatar
-- =====================================================================

-- 1) Utvid profiles -------------------------------------------------------
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists nickname text,
  add column if not exists must_change_password boolean default false,
  add column if not exists avatar_kind text default 'preset' check (avatar_kind in ('preset','upload','none')),
  add column if not exists avatar_preset text,                  -- f.eks. 'dicebear:avataaars:Sara'
  add column if not exists avatar_upload_path text,             -- path i storage-bucket
  add column if not exists avatar_zoom numeric default 1.0,     -- 0.5–3.0
  add column if not exists avatar_offset_x numeric default 0,   -- -100..+100 (prosent)
  add column if not exists avatar_offset_y numeric default 0,
  add column if not exists birth_date_visible_in uuid[] default '{}'; -- gruppe-IDer

-- Backfill display_name → first/last hvis tomt
update public.profiles
set first_name = coalesce(first_name, split_part(display_name, ' ', 1)),
    last_name = coalesce(last_name,
      nullif(trim(substring(display_name from position(' ' in display_name))), ''))
where first_name is null or last_name is null;

-- 2) Endringsforespørsler ------------------------------------------------
create type change_request_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type change_request_kind as enum ('name', 'birth_date', 'other');

create table public.profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,  -- hvilken gruppe-admin som skal godkjenne (null = system_admin)
  kind change_request_kind not null,
  current_value jsonb,
  requested_value jsonb not null,
  reason text,
  status change_request_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  reviewer_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_pcr_profile on public.profile_change_requests (profile_id, status);
create index idx_pcr_group on public.profile_change_requests (group_id, status);

alter table public.profile_change_requests enable row level security;

create policy "pcr_self_read" on public.profile_change_requests
  for select using (
    profile_id = auth.uid()
    or (group_id is not null and public.is_group_admin(group_id))
    or public.is_system_admin()
  );

create policy "pcr_self_insert" on public.profile_change_requests
  for insert with check (profile_id = auth.uid());

create policy "pcr_self_cancel" on public.profile_change_requests
  for update using (
    profile_id = auth.uid()
    or (group_id is not null and public.is_group_admin(group_id))
    or public.is_system_admin()
  );

drop trigger if exists trg_pcr_updated on public.profile_change_requests;
create trigger trg_pcr_updated
  before update on public.profile_change_requests
  for each row execute function public.set_updated_at();

-- 3) Avgjørelse-RPC -------------------------------------------------------
create or replace function public.review_change_request(
  p_request uuid, p_decision change_request_status, p_note text default null
) returns void
language plpgsql security definer
set search_path = public, auth
as $$
declare
  r public.profile_change_requests;
  v_uid uuid := auth.uid();
  v_first text;
  v_last text;
  v_birth date;
begin
  select * into r from public.profile_change_requests where id = p_request;
  if r is null then raise exception 'Forespørsel finnes ikke'; end if;
  if r.status <> 'pending' then raise exception 'Forespørselen er allerede behandlet'; end if;

  -- Tilgangssjekk: gruppe-admin (hvis group_id satt) eller system_admin
  if not (
    public.is_system_admin()
    or (r.group_id is not null and public.is_group_admin(r.group_id))
  ) then
    raise exception 'Mangler tilgang til å godkjenne';
  end if;

  if p_decision = 'approved' then
    if r.kind = 'name' then
      v_first := nullif(r.requested_value->>'first_name', '');
      v_last := nullif(r.requested_value->>'last_name', '');
      update public.profiles
        set first_name = coalesce(v_first, first_name),
            last_name  = coalesce(v_last, last_name),
            display_name = trim(coalesce(v_first, first_name) || ' ' || coalesce(v_last, last_name))
        where id = r.profile_id;
    elsif r.kind = 'birth_date' then
      v_birth := nullif(r.requested_value->>'birth_date', '')::date;
      update public.profiles set birth_date = v_birth where id = r.profile_id;
    end if;
  end if;

  update public.profile_change_requests
    set status = p_decision, reviewed_by = v_uid, reviewed_at = now(), reviewer_note = p_note
    where id = p_request;
end;
$$;

grant execute on function public.review_change_request(uuid, change_request_status, text) to authenticated;

-- 4) Storage-bucket for avatars ------------------------------------------
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Policy: alle kan LESE bucket (bilder er offentlige), kun innlogget kan skrive sin egen mappe
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars_public_read'
  ) then
    create policy "avatars_public_read" on storage.objects
      for select using (bucket_id = 'avatars');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars_self_write'
  ) then
    create policy "avatars_self_write" on storage.objects
      for insert with check (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars_self_update'
  ) then
    create policy "avatars_self_update" on storage.objects
      for update using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'avatars_self_delete'
  ) then
    create policy "avatars_self_delete" on storage.objects
      for delete using (
        bucket_id = 'avatars'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end$$;
