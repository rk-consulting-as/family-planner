-- =====================================================================
-- Patch 0027 — Granular tillatelser per rolle (med ny parent-rolle)
--
-- Roller, fra mest til minst privilegert:
--   system_admin (på profiles, på tvers av familier)
--   owner        (alltid full tilgang i sin gruppe)
--   admin        (full tilgang som default, kan justeres)
--   parent       (NY — mellom admin og member; "leder/forelder")
--   member       (begrenset)
--
-- Tillatelser:
--   Hver action har en nøkkel som "calendar.create_event"
--   Per gruppe lagres overstyringer i role_permissions
--   Mangler en rad → defaults i can_perform-funksjonen
--   Owners er alltid true uansett — kan ikke låses ut
-- =====================================================================

-- 1) Legg parent i group_role-enumet
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'group_role' and e.enumlabel = 'parent'
  ) then
    alter type group_role add value 'parent' before 'member';
  end if;
end$$;

-- 2) Tillatelse-matrise
create table if not exists public.role_permissions (
  group_id uuid not null references public.groups(id) on delete cascade,
  role group_role not null,
  action text not null,
  allowed boolean not null default false,
  updated_at timestamptz default now(),
  primary key (group_id, role, action)
);
create index if not exists idx_rp_group_role on public.role_permissions (group_id, role);

alter table public.role_permissions enable row level security;

drop policy if exists "rp_member_read" on public.role_permissions;
create policy "rp_member_read" on public.role_permissions
  for select using (public.is_group_member(group_id));

drop policy if exists "rp_admin_write" on public.role_permissions;
create policy "rp_admin_write" on public.role_permissions
  for all using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

-- 3) is_group_lead = owner OR admin OR parent (for "trusted adults"-sjekker)
create or replace function public.is_group_lead(p_group uuid, p_profile uuid default auth.uid())
returns boolean
language sql security definer stable as $$
  select
    public.is_system_admin(p_profile)
    or exists(
      select 1 from public.group_members
      where group_id = p_group
        and profile_id = p_profile
        and role in ('owner','admin','parent')
    );
$$;

grant execute on function public.is_group_lead(uuid, uuid) to authenticated;

-- 4) can_perform: sjekk granular tillatelse
create or replace function public.can_perform(
  p_action text,
  p_group uuid,
  p_profile uuid default auth.uid()
) returns boolean
language plpgsql security definer stable as $$
declare
  v_role text;
  v_explicit boolean;
begin
  if public.is_system_admin(p_profile) then return true; end if;

  select role into v_role from public.group_members
  where group_id = p_group and profile_id = p_profile;

  if v_role is null then return false; end if;

  -- Owner har alltid full tilgang (kan ikke låses ut)
  if v_role = 'owner' then return true; end if;

  -- Eksplisitt overstyring i role_permissions
  select allowed into v_explicit from public.role_permissions
  where group_id = p_group and role = v_role::group_role and action = p_action;
  if v_explicit is not null then return v_explicit; end if;

  -- Defaults per rolle
  return case v_role
    when 'admin' then case p_action
      -- Admin har det meste, men noen ting er låst til owner
      when 'group.delete'         then false
      when 'group.transfer_owner' then false
      else true
    end
    when 'parent' then case p_action
      -- Parent har "trusted adult"-tilgang, men ikke admin-styring
      when 'members.invite'              then true
      when 'members.approve_invitations' then true
      when 'members.remove'              then false
      when 'members.change_role'         then false
      when 'members.set_permissions'     then false
      when 'members.see_last_seen'       then true
      when 'group.delete'                then false
      when 'group.transfer_owner'        then false
      when 'roles.manage'                then false

      when 'calendar.create_event'    then true
      when 'calendar.edit_any_event'  then true
      when 'calendar.delete_any_event'then true
      when 'custody.manage'           then true
      when 'timetable.manage'         then true

      when 'chores.create'            then true
      when 'chores.assign_to_others'  then true
      when 'chores.approve'           then true
      when 'chores.delete'            then true

      when 'habits.create_for_others' then true
      when 'needs.delete_any'         then false
      when 'gifts.create_for_others'  then true

      when 'meals.manage'             then true
      when 'shopping.clear'           then true

      when 'expenses.create'          then true
      when 'expenses.edit_any'        then true
      when 'expenses.close_period'    then false

      when 'projects.create'          then true
      when 'projects.add_member'      then true
      when 'projects.ai_extract'      then true
      when 'projects.delete'          then false

      when 'walking.add_for_others'   then true
      when 'rewards.manual_grant'     then false

      else false
    end
    when 'member' then case p_action
      -- Member har bare grunnleggende selv-handlinger
      when 'calendar.create_event'    then true   -- egne events
      when 'chores.create'            then true   -- egne gjøremål
      when 'walking.add_for_others'   then false
      when 'meals.manage'             then false
      when 'shopping.clear'           then false
      else false
    end
    else false
  end;
end;
$$;

grant execute on function public.can_perform(text, uuid, uuid) to authenticated;

-- 5) Hjelpe-RPC: hent alle tillatelser for én rolle i en gruppe (alle 30+ keys)
create or replace function public.role_capabilities(p_group uuid, p_role group_role)
returns jsonb
language plpgsql security definer stable as $$
declare
  v_actions text[] := array[
    'group.delete','group.transfer_owner','roles.manage',
    'members.invite','members.approve_invitations','members.remove',
    'members.change_role','members.set_permissions','members.see_last_seen',
    'calendar.create_event','calendar.edit_any_event','calendar.delete_any_event',
    'custody.manage','timetable.manage',
    'chores.create','chores.assign_to_others','chores.approve','chores.delete',
    'habits.create_for_others',
    'needs.delete_any','gifts.create_for_others',
    'meals.manage','shopping.clear',
    'expenses.create','expenses.edit_any','expenses.close_period',
    'projects.create','projects.add_member','projects.ai_extract','projects.delete',
    'walking.add_for_others','rewards.manual_grant'
  ];
  v_action text;
  v_result jsonb := '{}'::jsonb;
  v_explicit boolean;
  v_default boolean;
begin
  if not public.is_group_member(p_group) then
    raise exception 'Mangler tilgang';
  end if;

  foreach v_action in array v_actions loop
    -- Sjekk eksplisitt
    select allowed into v_explicit from public.role_permissions
      where group_id = p_group and role = p_role and action = v_action;
    if v_explicit is not null then
      v_result := v_result || jsonb_build_object(v_action, v_explicit);
    else
      -- Hent default ved å midlertidig spørre can_perform med en dummy bruker
      -- Enklere: dupliser default-logikken her (litt redundant, men trygt)
      if p_role = 'owner' then v_default := true;
      elsif p_role = 'admin' then
        v_default := v_action not in ('group.delete', 'group.transfer_owner');
      elsif p_role = 'parent' then
        v_default := v_action in (
          'members.invite','members.approve_invitations','members.see_last_seen',
          'calendar.create_event','calendar.edit_any_event','calendar.delete_any_event',
          'custody.manage','timetable.manage',
          'chores.create','chores.assign_to_others','chores.approve','chores.delete',
          'habits.create_for_others','gifts.create_for_others',
          'meals.manage','shopping.clear',
          'expenses.create','expenses.edit_any',
          'projects.create','projects.add_member','projects.ai_extract',
          'walking.add_for_others'
        );
      elsif p_role = 'member' then
        v_default := v_action in ('calendar.create_event','chores.create');
      else
        v_default := false;
      end if;
      v_result := v_result || jsonb_build_object(v_action, v_default);
    end if;
  end loop;
  return v_result;
end;
$$;

grant execute on function public.role_capabilities(uuid, group_role) to authenticated;

-- 6) Set permission: admin kan endre
create or replace function public.set_role_permission(
  p_group uuid, p_role group_role, p_action text, p_allowed boolean
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_group_admin(p_group) then
    raise exception 'Mangler admin-tilgang';
  end if;
  if p_role = 'owner' then
    raise exception 'Owner-rollen kan ikke endres — har alltid full tilgang';
  end if;

  insert into public.role_permissions (group_id, role, action, allowed)
  values (p_group, p_role, p_action, p_allowed)
  on conflict (group_id, role, action)
    do update set allowed = excluded.allowed, updated_at = now();
end;
$$;

grant execute on function public.set_role_permission(uuid, group_role, text, boolean) to authenticated;

-- 7) Tilbakestill: slett overstyringen for en celle
create or replace function public.reset_role_permission(
  p_group uuid, p_role group_role, p_action text
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_group_admin(p_group) then
    raise exception 'Mangler admin-tilgang';
  end if;
  delete from public.role_permissions
    where group_id = p_group and role = p_role and action = p_action;
end;
$$;

grant execute on function public.reset_role_permission(uuid, group_role, text) to authenticated;
