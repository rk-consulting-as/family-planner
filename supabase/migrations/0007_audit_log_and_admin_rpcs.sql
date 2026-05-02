-- =====================================================================
-- Patch 0007 — Audit log + admin RPCs for backoffice
-- =====================================================================

-- AUDIT LOG ----------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  actor_email text,
  action text not null,           -- 'group.create', 'group.delete', 'member.remove', etc.
  target_kind text,               -- 'group','profile','chore', ...
  target_id uuid,
  group_id uuid references public.groups(id) on delete set null,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_audit_actor on public.audit_log (actor_id, created_at desc);
create index if not exists idx_audit_group on public.audit_log (group_id, created_at desc);
create index if not exists idx_audit_action on public.audit_log (action, created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "audit_admin_read" on public.audit_log;
create policy "audit_admin_read" on public.audit_log
  for select using (public.is_system_admin());

drop policy if exists "audit_system_insert" on public.audit_log;
create policy "audit_system_insert" on public.audit_log
  for insert with check (true);  -- inserts via SECURITY DEFINER-funksjoner

-- Helper for å logge en hendelse
create or replace function public.log_audit(
  p_action text,
  p_target_kind text default null,
  p_target_id uuid default null,
  p_group_id uuid default null,
  p_payload jsonb default '{}'::jsonb
) returns void
language plpgsql security definer as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();
  insert into public.audit_log (actor_id, actor_email, action, target_kind, target_id, group_id, payload)
  values (auth.uid(), v_email, p_action, p_target_kind, p_target_id, p_group_id, p_payload);
end;
$$;

grant execute on function public.log_audit(text, text, uuid, uuid, jsonb) to authenticated;

-- ADMIN RPCS ---------------------------------------------------------

-- Opprett gruppe for en annen bruker
create or replace function public.admin_create_group_for_user(
  p_owner uuid, p_name text, p_type group_type default 'family'
) returns uuid
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
  v_code text := upper(substring(md5(random()::text), 1, 8));
begin
  if not public.is_system_admin() then
    raise exception 'Only system admins';
  end if;

  -- Sikre profil
  insert into public.profiles (id, display_name, email)
  select p_owner,
         coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email,'@',1), 'Bruker'),
         u.email
  from auth.users u where u.id = p_owner
  on conflict (id) do nothing;

  insert into public.notification_preferences (profile_id) values (p_owner)
  on conflict (profile_id) do nothing;

  insert into public.groups (name, type, owner_id, invite_code)
  values (p_name, p_type, p_owner, v_code)
  returning id into v_id;

  insert into public.group_members (group_id, profile_id, role)
  values (v_id, p_owner, 'owner')
  on conflict (group_id, profile_id) do nothing;

  perform public.log_audit('group.create_for_user', 'group', v_id, v_id,
    jsonb_build_object('owner', p_owner, 'name', p_name));
  return v_id;
end;
$$;

grant execute on function public.admin_create_group_for_user(uuid, text, group_type) to authenticated;

-- Slett gruppe (soft delete)
create or replace function public.admin_delete_group(p_group uuid)
returns void
language plpgsql security definer
set search_path = public, auth
as $$
begin
  if not public.is_system_admin() then
    raise exception 'Only system admins';
  end if;
  update public.groups set deleted_at = now() where id = p_group;
  perform public.log_audit('group.delete', 'group', p_group, p_group, '{}'::jsonb);
end;
$$;

grant execute on function public.admin_delete_group(uuid) to authenticated;

-- Bytt eier
create or replace function public.admin_transfer_ownership(p_group uuid, p_new_owner uuid)
returns void
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_old uuid;
begin
  if not public.is_system_admin() then
    raise exception 'Only system admins';
  end if;

  select owner_id into v_old from public.groups where id = p_group;

  -- Sikre at ny eier finnes som member
  insert into public.group_members (group_id, profile_id, role)
  values (p_group, p_new_owner, 'owner')
  on conflict (group_id, profile_id) do update set role = 'owner';

  -- Gjør gammel eier til admin (ikke degrader til member)
  if v_old is not null and v_old <> p_new_owner then
    update public.group_members set role = 'admin'
      where group_id = p_group and profile_id = v_old;
  end if;

  update public.groups set owner_id = p_new_owner where id = p_group;

  perform public.log_audit('group.transfer_ownership', 'group', p_group, p_group,
    jsonb_build_object('from', v_old, 'to', p_new_owner));
end;
$$;

grant execute on function public.admin_transfer_ownership(uuid, uuid) to authenticated;

-- Eksporter alt om en gruppe som JSON
create or replace function public.admin_export_group(p_group uuid)
returns jsonb
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v jsonb;
begin
  if not public.is_system_admin() then
    raise exception 'Only system admins';
  end if;

  select jsonb_build_object(
    'group',         (select to_jsonb(g) from public.groups g where g.id = p_group),
    'members',       (select coalesce(jsonb_agg(jsonb_build_object(
                          'profile', to_jsonb(p),
                          'role', gm.role,
                          'joined_at', gm.joined_at)), '[]'::jsonb)
                      from public.group_members gm
                      join public.profiles p on p.id = gm.profile_id
                      where gm.group_id = p_group),
    'chores',        (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
                      from public.chores c where c.group_id = p_group),
    'chore_assignments',
                     (select coalesce(jsonb_agg(to_jsonb(ca)), '[]'::jsonb)
                      from public.chore_assignments ca where ca.group_id = p_group),
    'timetable_entries',
                     (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
                      from public.timetable_entries t where t.group_id = p_group),
    'walking_entries',
                     (select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb)
                      from public.walking_entries w where w.group_id = p_group),
    'reward_transactions',
                     (select coalesce(jsonb_agg(to_jsonb(rt)), '[]'::jsonb)
                      from public.reward_transactions rt where rt.group_id = p_group),
    'goals',         (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb)
                      from public.goals g where g.group_id = p_group),
    'events',        (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
                      from public.events e where e.group_id = p_group),
    'exported_at',   now()
  ) into v;

  perform public.log_audit('group.export', 'group', p_group, p_group, '{}'::jsonb);
  return v;
end;
$$;

grant execute on function public.admin_export_group(uuid) to authenticated;

-- Hent audit-log
create or replace function public.admin_recent_audit(p_limit int default 100)
returns setof public.audit_log
language sql security definer stable as $$
  select * from public.audit_log
  where public.is_system_admin()
  order by created_at desc
  limit p_limit;
$$;

grant execute on function public.admin_recent_audit(int) to authenticated;

-- Trigger-baserte logger på de viktigste tabellene -------------------
create or replace function public._audit_trg() returns trigger
language plpgsql security definer as $$
declare
  v_action text := tg_table_name || '.' || lower(tg_op);
  v_id uuid;
  v_group uuid;
begin
  v_id := coalesce((new).id::uuid, (old).id::uuid);
  -- group_id-felt der det finnes
  begin
    v_group := (new).group_id::uuid;
  exception when others then
    begin
      v_group := (old).group_id::uuid;
    exception when others then v_group := null; end;
  end;
  if tg_op = 'DELETE' then
    perform public.log_audit(v_action, tg_table_name, (old).id::uuid, v_group, to_jsonb(old));
  else
    perform public.log_audit(v_action, tg_table_name, (new).id::uuid, v_group, to_jsonb(new));
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_audit_groups on public.groups;
create trigger trg_audit_groups
  after insert or update or delete on public.groups
  for each row execute function public._audit_trg();

drop trigger if exists trg_audit_group_members on public.group_members;
create trigger trg_audit_group_members
  after insert or update or delete on public.group_members
  for each row execute function public._audit_trg();

drop trigger if exists trg_audit_chores on public.chores;
create trigger trg_audit_chores
  after insert or update or delete on public.chores
  for each row execute function public._audit_trg();
