-- =====================================================================
-- Patch 0012 — Kommentarer, vedlegg, historikk for ønsker. Bilde-bevis
-- på gjøremål.
-- =====================================================================

-- KOMMENTARER PÅ ØNSKER -------------------------------------------------
create table if not exists public.need_comments (
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null references public.needs(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index idx_nc_need on public.need_comments (need_id, created_at);

alter table public.need_comments enable row level security;

-- Lese: alle som kan lese selve ønsket kan lese kommentarer
drop policy if exists "nc_read" on public.need_comments;
create policy "nc_read" on public.need_comments
  for select using (
    exists(
      select 1 from public.needs n
      where n.id = need_comments.need_id
        and (
          n.requested_by = auth.uid()
          or auth.uid() = any (n.visible_to)
          or (cardinality(n.visible_to) = 0 and public.is_group_admin(n.group_id))
          or public.is_group_admin(n.group_id)
        )
    )
  );

-- Skrive: samme tilgang
drop policy if exists "nc_insert" on public.need_comments;
create policy "nc_insert" on public.need_comments
  for insert with check (
    author_id = auth.uid() and
    exists(
      select 1 from public.needs n
      where n.id = need_comments.need_id
        and (
          n.requested_by = auth.uid()
          or auth.uid() = any (n.visible_to)
          or public.is_group_admin(n.group_id)
        )
    )
  );

-- Oppdatering/sletting: bare forfatter eller admin
drop policy if exists "nc_update_own" on public.need_comments;
create policy "nc_update_own" on public.need_comments
  for update using (
    author_id = auth.uid()
    or exists(
      select 1 from public.needs n
      where n.id = need_comments.need_id and public.is_group_admin(n.group_id)
    )
  );

create policy "nc_delete_own" on public.need_comments
  for delete using (
    author_id = auth.uid()
    or exists(
      select 1 from public.needs n
      where n.id = need_comments.need_id and public.is_group_admin(n.group_id)
    )
  );

drop trigger if exists trg_nc_updated on public.need_comments;
create trigger trg_nc_updated before update on public.need_comments
  for each row execute function public.set_updated_at();

-- VEDLEGG PÅ ØNSKER -----------------------------------------------------
create table if not exists public.need_attachments (
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null references public.needs(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete set null,
  kind text not null default 'image' check (kind in ('image', 'file')),
  storage_path text not null,
  public_url text not null,
  filename text,
  mime_type text,
  size_bytes int,
  created_at timestamptz default now()
);
create index idx_na_need on public.need_attachments (need_id, created_at);

alter table public.need_attachments enable row level security;

create policy "na_read" on public.need_attachments
  for select using (
    exists(
      select 1 from public.needs n
      where n.id = need_attachments.need_id
        and (
          n.requested_by = auth.uid()
          or auth.uid() = any (n.visible_to)
          or (cardinality(n.visible_to) = 0 and public.is_group_admin(n.group_id))
          or public.is_group_admin(n.group_id)
        )
    )
  );

create policy "na_insert" on public.need_attachments
  for insert with check (
    uploaded_by = auth.uid() and
    exists(
      select 1 from public.needs n
      where n.id = need_attachments.need_id
        and public.is_group_member(n.group_id)
    )
  );

create policy "na_delete_own" on public.need_attachments
  for delete using (
    uploaded_by = auth.uid()
    or exists(
      select 1 from public.needs n
      where n.id = need_attachments.need_id and public.is_group_admin(n.group_id)
    )
  );

-- HISTORIKK FOR ØNSKER --------------------------------------------------
create table if not exists public.need_history (
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null references public.needs(id) on delete cascade,
  edited_by uuid references public.profiles(id),
  field text not null,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz default now()
);
create index idx_nh_need on public.need_history (need_id, created_at desc);

alter table public.need_history enable row level security;

create policy "nh_read" on public.need_history
  for select using (
    exists(
      select 1 from public.needs n
      where n.id = need_history.need_id
        and (
          n.requested_by = auth.uid()
          or auth.uid() = any (n.visible_to)
          or public.is_group_admin(n.group_id)
        )
    )
  );

-- Trigger som logger endringer
create or replace function public._needs_history_trg()
returns trigger language plpgsql security definer as $$
begin
  if NEW.title is distinct from OLD.title then
    insert into public.need_history (need_id, edited_by, field, old_value, new_value)
      values (NEW.id, auth.uid(), 'title', to_jsonb(OLD.title), to_jsonb(NEW.title));
  end if;
  if NEW.description is distinct from OLD.description then
    insert into public.need_history (need_id, edited_by, field, old_value, new_value)
      values (NEW.id, auth.uid(), 'description', to_jsonb(OLD.description), to_jsonb(NEW.description));
  end if;
  if NEW.category is distinct from OLD.category then
    insert into public.need_history (need_id, edited_by, field, old_value, new_value)
      values (NEW.id, auth.uid(), 'category', to_jsonb(OLD.category), to_jsonb(NEW.category));
  end if;
  if NEW.priority is distinct from OLD.priority then
    insert into public.need_history (need_id, edited_by, field, old_value, new_value)
      values (NEW.id, auth.uid(), 'priority', to_jsonb(OLD.priority), to_jsonb(NEW.priority));
  end if;
  if NEW.location_note is distinct from OLD.location_note then
    insert into public.need_history (need_id, edited_by, field, old_value, new_value)
      values (NEW.id, auth.uid(), 'location_note', to_jsonb(OLD.location_note), to_jsonb(NEW.location_note));
  end if;
  if NEW.status is distinct from OLD.status then
    insert into public.need_history (need_id, edited_by, field, old_value, new_value)
      values (NEW.id, auth.uid(), 'status', to_jsonb(OLD.status), to_jsonb(NEW.status));
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_needs_history on public.needs;
create trigger trg_needs_history
  after update on public.needs
  for each row execute function public._needs_history_trg();

-- STORAGE BUCKET FOR VEDLEGG OG GJØREMÅL-BEVIS --------------------------
insert into storage.buckets (id, name, public)
  values ('attachments', 'attachments', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'attachments_public_read'
  ) then
    create policy "attachments_public_read" on storage.objects
      for select using (bucket_id = 'attachments');
  end if;

  -- Innlogget bruker kan laste opp i sin egen mappe
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'attachments_self_write'
  ) then
    create policy "attachments_self_write" on storage.objects
      for insert with check (
        bucket_id = 'attachments'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'attachments_self_delete'
  ) then
    create policy "attachments_self_delete" on storage.objects
      for delete using (
        bucket_id = 'attachments'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end$$;
