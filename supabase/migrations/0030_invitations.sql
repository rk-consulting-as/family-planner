-- =====================================================================
-- Patch 0030 — AI-genererte invitasjoner (bursdag, bryllup osv.)
--
-- MERK: tabellen heter event_invitations for å unngå kollisjon med den
-- eksisterende `invitations`-tabellen som brukes for gruppe-invitasjons-
-- lenker (migration 0001/0019).
-- =====================================================================

-- Hvis migrasjonen ble kjørt delvis tidligere — rydd opp i types.
-- (PG støtter ikke "create type if not exists", så vi dropper og lager nytt.)
drop type if exists invitation_asset_kind cascade;
drop type if exists invitation_image_mode cascade;
drop type if exists invitation_status cascade;
drop type if exists invitation_format cascade;
drop type if exists invitation_occasion cascade;

create type invitation_occasion as enum (
  'childrens_birthday',
  'milestone_birthday',
  'wedding_anniversary',
  'school_event',
  'class_party',
  'sports_event',
  'graduation',
  'generic'
);

create type invitation_format as enum (
  'a5_print',
  'a6_print',
  'square_1_1',
  'portrait_4_5',
  'story_9_16',
  'banner_16_9'
);

create type invitation_status as enum ('draft', 'finalized', 'sent');

create type invitation_image_mode as enum ('template', 'ai_generated');

create type invitation_asset_kind as enum (
  'host_photo',
  'venue_photo',
  'logo',
  'extra'
);

create table if not exists public.event_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id),

  occasion invitation_occasion not null default 'generic',
  theme text not null default 'klassisk',
  format invitation_format not null default 'a5_print',
  image_mode invitation_image_mode not null default 'template',

  title text not null,
  host_name text,
  host_age int,
  event_date date,
  event_time time,
  location text,
  location_details text,
  dress_code text,
  gift_info text,
  rsvp_deadline date,
  rsvp_contact text,
  extra_notes text,

  generated_text text,
  generated_image_url text,

  final_image_url text,
  final_pdf_url text,

  event_id uuid references public.events(id) on delete set null,

  status invitation_status not null default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index if not exists idx_event_invitations_group on public.event_invitations (group_id)
  where deleted_at is null;
create index if not exists idx_event_invitations_creator on public.event_invitations (created_by);

create table if not exists public.event_invitation_attachments (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.event_invitations(id) on delete cascade,
  kind invitation_asset_kind not null default 'extra',
  storage_path text not null,
  public_url text,
  mime_type text,
  size_bytes int,
  caption text,
  position int default 0,
  created_at timestamptz default now()
);
create index if not exists idx_event_invitation_assets
  on public.event_invitation_attachments (invitation_id, position);

-- =====================================================================
-- RLS
-- =====================================================================

alter table public.event_invitations enable row level security;
alter table public.event_invitation_attachments enable row level security;

drop policy if exists event_invitations_select on public.event_invitations;
create policy event_invitations_select on public.event_invitations
  for select using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = event_invitations.group_id
        and gm.profile_id = auth.uid()
    )
  );

drop policy if exists event_invitations_insert on public.event_invitations;
create policy event_invitations_insert on public.event_invitations
  for insert with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = event_invitations.group_id
        and gm.profile_id = auth.uid()
    )
  );

drop policy if exists event_invitations_update on public.event_invitations;
create policy event_invitations_update on public.event_invitations
  for update using (
    created_by = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = event_invitations.group_id
        and gm.profile_id = auth.uid()
        and gm.role in ('owner', 'admin')
    )
  );

drop policy if exists event_invitations_delete on public.event_invitations;
create policy event_invitations_delete on public.event_invitations
  for delete using (
    created_by = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = event_invitations.group_id
        and gm.profile_id = auth.uid()
        and gm.role in ('owner', 'admin')
    )
  );

drop policy if exists event_invitation_assets_select on public.event_invitation_attachments;
create policy event_invitation_assets_select on public.event_invitation_attachments
  for select using (
    exists (
      select 1 from public.event_invitations inv
      join public.group_members gm on gm.group_id = inv.group_id
      where inv.id = event_invitation_attachments.invitation_id
        and gm.profile_id = auth.uid()
    )
  );

drop policy if exists event_invitation_assets_insert on public.event_invitation_attachments;
create policy event_invitation_assets_insert on public.event_invitation_attachments
  for insert with check (
    exists (
      select 1 from public.event_invitations inv
      where inv.id = event_invitation_attachments.invitation_id
        and inv.created_by = auth.uid()
    )
  );

drop policy if exists event_invitation_assets_delete on public.event_invitation_attachments;
create policy event_invitation_assets_delete on public.event_invitation_attachments
  for delete using (
    exists (
      select 1 from public.event_invitations inv
      where inv.id = event_invitation_attachments.invitation_id
        and inv.created_by = auth.uid()
    )
  );

-- Realtime (legg til hvis ikke allerede der)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'event_invitations'
  ) then
    execute 'alter publication supabase_realtime add table public.event_invitations';
  end if;
end $$;
