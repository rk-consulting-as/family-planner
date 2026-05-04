-- =====================================================================
-- Patch 0015 — Online-status + chat
--
-- Presence:
--   profiles.last_seen_at  — oppdateres ved hver bruker-aktivitet
--                            ("online" = oppdatert siste 3 minutter)
--   profiles.online_visible — bruker velger om andre kan se status
--                            Admins kan alltid se status og last_seen.
--
-- Chat:
--   chat_threads             — tråd (direkte 1-til-1 eller gruppe)
--   chat_thread_members      — hvem er med i tråden
--   chat_messages            — meldinger
-- =====================================================================

-- PRESENCE -----------------------------------------------------------
alter table public.profiles
  add column if not exists last_seen_at timestamptz,
  add column if not exists online_visible boolean default true;

create or replace function public.touch_presence()
returns void
language sql security definer
set search_path = public
as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;

grant execute on function public.touch_presence() to authenticated;

-- CHAT ---------------------------------------------------------------
create type chat_thread_kind as enum ('direct', 'group');

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  kind chat_thread_kind not null default 'direct',
  name text,                                  -- bare for 'group'
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now(),
  last_message_at timestamptz default now()
);
create index if not exists idx_ct_group on public.chat_threads (group_id, last_message_at desc);

create table if not exists public.chat_thread_members (
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  last_read_at timestamptz,
  primary key (thread_id, profile_id)
);
create index if not exists idx_ctm_profile on public.chat_thread_members (profile_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  body text not null,
  created_at timestamptz default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index if not exists idx_cm_thread on public.chat_messages (thread_id, created_at);

-- updated_at-style: oppdater last_message_at når ny melding kommer
create or replace function public._chat_bump_thread()
returns trigger language plpgsql security definer as $$
begin
  update public.chat_threads set last_message_at = NEW.created_at where id = NEW.thread_id;
  return NEW;
end;
$$;

drop trigger if exists trg_cm_bump on public.chat_messages;
create trigger trg_cm_bump
  after insert on public.chat_messages
  for each row execute function public._chat_bump_thread();

-- RLS ---------------------------------------------------------------
alter table public.chat_threads enable row level security;
alter table public.chat_thread_members enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "ct_member_read" on public.chat_threads;
create policy "ct_member_read" on public.chat_threads
  for select using (
    public.is_group_member(group_id) and exists(
      select 1 from public.chat_thread_members ctm
      where ctm.thread_id = chat_threads.id and ctm.profile_id = auth.uid()
    )
    or public.is_group_admin(group_id)
  );

drop policy if exists "ct_create" on public.chat_threads;
create policy "ct_create" on public.chat_threads
  for insert with check (
    public.is_group_member(group_id) and created_by = auth.uid()
  );

drop policy if exists "ctm_member_read" on public.chat_thread_members;
create policy "ctm_member_read" on public.chat_thread_members
  for select using (
    profile_id = auth.uid()
    or exists(
      select 1 from public.chat_thread_members me
      where me.thread_id = chat_thread_members.thread_id and me.profile_id = auth.uid()
    )
    or exists(
      select 1 from public.chat_threads t
      where t.id = chat_thread_members.thread_id and public.is_group_admin(t.group_id)
    )
  );

drop policy if exists "ctm_self_or_creator_insert" on public.chat_thread_members;
create policy "ctm_self_or_creator_insert" on public.chat_thread_members
  for insert with check (
    -- Du kan legge deg selv inn, eller du har nettopp opprettet tråden
    profile_id = auth.uid()
    or exists(
      select 1 from public.chat_threads t
      where t.id = chat_thread_members.thread_id and t.created_by = auth.uid()
    )
  );

drop policy if exists "ctm_self_update" on public.chat_thread_members;
create policy "ctm_self_update" on public.chat_thread_members
  for update using (profile_id = auth.uid());

drop policy if exists "ctm_self_delete" on public.chat_thread_members;
create policy "ctm_self_delete" on public.chat_thread_members
  for delete using (profile_id = auth.uid());

drop policy if exists "cm_thread_member_read" on public.chat_messages;
create policy "cm_thread_member_read" on public.chat_messages
  for select using (
    exists(
      select 1 from public.chat_thread_members ctm
      where ctm.thread_id = chat_messages.thread_id and ctm.profile_id = auth.uid()
    )
  );

drop policy if exists "cm_thread_member_insert" on public.chat_messages;
create policy "cm_thread_member_insert" on public.chat_messages
  for insert with check (
    sender_id = auth.uid()
    and exists(
      select 1 from public.chat_thread_members ctm
      where ctm.thread_id = chat_messages.thread_id and ctm.profile_id = auth.uid()
    )
  );

drop policy if exists "cm_self_update" on public.chat_messages;
create policy "cm_self_update" on public.chat_messages
  for update using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

drop policy if exists "cm_self_delete" on public.chat_messages;
create policy "cm_self_delete" on public.chat_messages
  for delete using (sender_id = auth.uid());

-- Realtime publication ------------------------------------------------
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.chat_threads;

-- RPC: opprett eller hent direktetråd mellom to brukere ----------------
create or replace function public.get_or_create_direct_thread(
  p_group uuid, p_other uuid
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_thread uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.is_group_member(p_group) then raise exception 'Mangler tilgang'; end if;
  if v_uid = p_other then raise exception 'Kan ikke chatte med deg selv'; end if;

  -- Søk etter eksisterende direktetråd med begge to medlemmer
  select t.id into v_thread
  from public.chat_threads t
  where t.group_id = p_group and t.kind = 'direct'
    and exists(select 1 from public.chat_thread_members where thread_id = t.id and profile_id = v_uid)
    and exists(select 1 from public.chat_thread_members where thread_id = t.id and profile_id = p_other)
    and (select count(*) from public.chat_thread_members where thread_id = t.id) = 2
  limit 1;

  if v_thread is not null then return v_thread; end if;

  insert into public.chat_threads (group_id, kind, created_by)
    values (p_group, 'direct', v_uid)
    returning id into v_thread;

  insert into public.chat_thread_members (thread_id, profile_id) values (v_thread, v_uid);
  insert into public.chat_thread_members (thread_id, profile_id) values (v_thread, p_other);

  return v_thread;
end;
$$;

grant execute on function public.get_or_create_direct_thread(uuid, uuid) to authenticated;

-- RPC: opprett gruppetråd ---------------------------------------------
create or replace function public.create_group_thread(
  p_group uuid, p_name text, p_member_ids uuid[]
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_thread uuid;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  if not public.is_group_member(p_group) then raise exception 'Mangler tilgang'; end if;

  insert into public.chat_threads (group_id, kind, name, created_by)
    values (p_group, 'group', p_name, v_uid)
    returning id into v_thread;

  insert into public.chat_thread_members (thread_id, profile_id) values (v_thread, v_uid);

  foreach v_id in array p_member_ids loop
    if v_id <> v_uid then
      insert into public.chat_thread_members (thread_id, profile_id)
        values (v_thread, v_id) on conflict do nothing;
    end if;
  end loop;

  return v_thread;
end;
$$;

grant execute on function public.create_group_thread(uuid, text, uuid[]) to authenticated;

-- View: tråder for innlogget bruker, med antall uleste meldinger
create or replace view public.my_chat_threads as
select
  t.id, t.group_id, t.kind, t.name, t.created_by, t.created_at, t.last_message_at,
  ctm.last_read_at,
  (select count(*) from public.chat_messages m
   where m.thread_id = t.id
     and m.deleted_at is null
     and m.sender_id <> auth.uid()
     and (ctm.last_read_at is null or m.created_at > ctm.last_read_at)) as unread_count
from public.chat_threads t
join public.chat_thread_members ctm on ctm.thread_id = t.id
where ctm.profile_id = auth.uid();

grant select on public.my_chat_threads to authenticated;
