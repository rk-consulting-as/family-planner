-- =====================================================================
-- Patch 0028 — Fiks RPC-signaturer som bruker enum-parametre
--
-- Problem: PostgREST sin schema-cache klarer ikke matche RPC-kall når
-- parameter-typen er en custom enum (group_role). JS-klienten sender alltid
-- text, og automatisk casting fungerer ikke for parameter-resolution.
--
-- Løsning: bytt enum-parametre til text og cast inne i funksjonen.
-- =====================================================================

-- Drop gamle enum-baserte versjoner
drop function if exists public.set_role_permission(uuid, group_role, text, boolean);
drop function if exists public.reset_role_permission(uuid, group_role, text);
drop function if exists public.role_capabilities(uuid, group_role);

-- Set permission med text-parameter
create or replace function public.set_role_permission(
  p_group uuid, p_role text, p_action text, p_allowed boolean
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_role group_role := p_role::group_role;
begin
  if not public.is_group_admin(p_group) then
    raise exception 'Mangler admin-tilgang';
  end if;
  if v_role = 'owner' then
    raise exception 'Owner-rollen kan ikke endres — har alltid full tilgang';
  end if;

  insert into public.role_permissions (group_id, role, action, allowed)
  values (p_group, v_role, p_action, p_allowed)
  on conflict (group_id, role, action)
    do update set allowed = excluded.allowed, updated_at = now();
end;
$$;

grant execute on function public.set_role_permission(uuid, text, text, boolean) to authenticated;

-- Reset permission med text-parameter
create or replace function public.reset_role_permission(
  p_group uuid, p_role text, p_action text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_role group_role := p_role::group_role;
begin
  if not public.is_group_admin(p_group) then
    raise exception 'Mangler admin-tilgang';
  end if;
  delete from public.role_permissions
    where group_id = p_group and role = v_role and action = p_action;
end;
$$;

grant execute on function public.reset_role_permission(uuid, text, text) to authenticated;

-- Role capabilities med text-parameter
create or replace function public.role_capabilities(p_group uuid, p_role text)
returns jsonb
language plpgsql security definer stable as $$
declare
  v_role group_role := p_role::group_role;
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
    select allowed into v_explicit from public.role_permissions
      where group_id = p_group and role = v_role and action = v_action;
    if v_explicit is not null then
      v_result := v_result || jsonb_build_object(v_action, v_explicit);
    else
      if v_role = 'owner' then v_default := true;
      elsif v_role = 'admin' then
        v_default := v_action not in ('group.delete', 'group.transfer_owner');
      elsif v_role = 'parent' then
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
      elsif v_role = 'member' then
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

grant execute on function public.role_capabilities(uuid, text) to authenticated;

-- Refresh PostgREST schema-cache
notify pgrst, 'reload schema';
