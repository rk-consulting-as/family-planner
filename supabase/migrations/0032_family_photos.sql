-- =====================================================================
-- Patch 0032 — Familiens fotobibliotek
--
-- Delt fotoalbum. Bilder kan brukes som hero på ønsker, oppskrifter osv.
-- =====================================================================

create table if not exists public.photo_albums (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,                  -- "Sommerferie 2026", "Henriks 7-årsdag"
  description text,
  cover_photo_id uuid,                  -- FK fyll inn etter family_photos lages
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.family_photos (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  album_id uuid references public.photo_albums(id) on delete set null,

  uploaded_by uuid not null references public.profiles(id),
  storage_path text not null,
  public_url text,
  thumbnail_url text,
  mime_type text,
  size_bytes int,
  width int,
  height int,

  caption text,
  taken_at timestamptz,                 -- fra EXIF eller manuelt satt

  tagged_profile_ids uuid[] default '{}',  -- hvem er på bildet

  created_at timestamptz default now(),
  deleted_at timestamptz
);
create index if not exists idx_family_photos_group on public.family_photos (group_id, created_at desc)
  where deleted_at is null;
create index if not exists idx_family_photos_album on public.family_photos (album_id, created_at desc)
  where deleted_at is null;
create index if not exists idx_family_photos_tagged on public.family_photos using gin (tagged_profile_ids)
  where deleted_at is null;

-- Nå kan vi koble album-cover
alter table public.photo_albums
  add constraint photo_albums_cover_fk
  foreign key (cover_photo_id) references public.family_photos(id) on delete set null;

-- Kommentarer på bilder (gjenbruker ikke kommentar-tabeller; eget for klar separasjon)
create table if not exists public.photo_comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.family_photos(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz default now(),
  deleted_at timestamptz
);
create index if not exists idx_photo_comments_photo on public.photo_comments (photo_id, created_at);

-- RLS
alter table public.photo_albums enable row level security;
alter table public.family_photos enable row level security;
alter table public.photo_comments enable row level security;

drop policy if exists photo_albums_select on public.photo_albums;
create policy photo_albums_select on public.photo_albums
  for select using (
    exists (select 1 from public.group_members gm
            where gm.group_id = photo_albums.group_id and gm.profile_id = auth.uid())
  );

drop policy if exists photo_albums_modify on public.photo_albums;
create policy photo_albums_modify on public.photo_albums
  for all using (
    exists (select 1 from public.group_members gm
            where gm.group_id = photo_albums.group_id and gm.profile_id = auth.uid())
  );

drop policy if exists family_photos_select on public.family_photos;
create policy family_photos_select on public.family_photos
  for select using (
    exists (select 1 from public.group_members gm
            where gm.group_id = family_photos.group_id and gm.profile_id = auth.uid())
  );

drop policy if exists family_photos_insert on public.family_photos;
create policy family_photos_insert on public.family_photos
  for insert with check (
    uploaded_by = auth.uid()
    and exists (select 1 from public.group_members gm
                where gm.group_id = family_photos.group_id and gm.profile_id = auth.uid())
  );

drop policy if exists family_photos_modify on public.family_photos;
create policy family_photos_modify on public.family_photos
  for update using (
    uploaded_by = auth.uid()
    or exists (select 1 from public.group_members gm
               where gm.group_id = family_photos.group_id
                 and gm.profile_id = auth.uid()
                 and gm.role in ('owner', 'admin'))
  );

drop policy if exists family_photos_delete on public.family_photos;
create policy family_photos_delete on public.family_photos
  for delete using (
    uploaded_by = auth.uid()
    or exists (select 1 from public.group_members gm
               where gm.group_id = family_photos.group_id
                 and gm.profile_id = auth.uid()
                 and gm.role in ('owner', 'admin'))
  );

drop policy if exists photo_comments_select on public.photo_comments;
create policy photo_comments_select on public.photo_comments
  for select using (
    exists (
      select 1 from public.family_photos fp
      join public.group_members gm on gm.group_id = fp.group_id
      where fp.id = photo_comments.photo_id and gm.profile_id = auth.uid()
    )
  );

drop policy if exists photo_comments_insert on public.photo_comments;
create policy photo_comments_insert on public.photo_comments
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.family_photos fp
      join public.group_members gm on gm.group_id = fp.group_id
      where fp.id = photo_comments.photo_id and gm.profile_id = auth.uid()
    )
  );
