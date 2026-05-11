-- =====================================================================
-- Patch 0026 — Modul-tilganger per medlem
--
-- Roller:
--   owner / admin (= forelder/leder)  → ser alt automatisk
--   member                            → har module_access som styrer
--                                        hvilke deler av appen de ser
--   system_admin (på profiles)        → ser alt på tvers (uendret)
--
-- module_access er en JSONB der nøkler er modul-keys (chat, gifts,
-- expenses, projects, meals, shopping, needs, member_info) og verdier
-- er boolean. Manglende nøkkel betyr at standard-verdien for modulen
-- gjelder (se can_see_module-funksjonen).
-- =====================================================================

alter table public.group_members
  add column if not exists module_access jsonb default '{}'::jsonb;

create or replace function public.can_see_module(
  p_module text,
  p_group uuid,
  p_profile uuid default auth.uid()
) returns boolean
language plpgsql security definer stable as $$
declare
  v_role text;
  v_access jsonb;
  v_explicit boolean;
begin
  -- System admins ser alt
  if public.is_system_admin(p_profile) then return true; end if;

  -- Hent rolle + tilgangs-jsonb
  select role, coalesce(module_access, '{}'::jsonb)
    into v_role, v_access
  from public.group_members
  where group_id = p_group and profile_id = p_profile;

  if v_role is null then return false; end if;

  -- Owner/admin ser alt
  if v_role in ('owner', 'admin') then return true; end if;

  -- Sjekk eksplisitt overstyring
  if v_access ? p_module then
    v_explicit := (v_access ->> p_module)::boolean;
    return v_explicit;
  end if;

  -- Standard-verdier for member-rollen
  return case p_module
    when 'calendar'    then true
    when 'chores'      then true
    when 'habits'      then true
    when 'rewards'     then true
    when 'walking'     then true
    when 'chat'        then true
    when 'needs'       then true
    when 'gifts'       then true
    when 'meals'       then true
    when 'shopping'    then true
    when 'expenses'    then false   -- sensitivt: økonomi
    when 'projects'    then false   -- sensitivt: utredning/saker
    when 'member_info' then false   -- andres helsedata osv.
    else true
  end;
end;
$$;

grant execute on function public.can_see_module(text, uuid, uuid) to authenticated;

-- Hjelpe-RPC: hent alle modul-tilganger for én bruker i én spørring
create or replace function public.my_module_access(p_group uuid)
returns jsonb
language plpgsql security definer stable as $$
declare
  v_modules text[] := array['calendar','chores','habits','rewards','walking',
                            'chat','needs','gifts','meals','shopping',
                            'expenses','projects','member_info'];
  v_mod text;
  v_result jsonb := '{}'::jsonb;
begin
  foreach v_mod in array v_modules loop
    v_result := v_result || jsonb_build_object(
      v_mod, public.can_see_module(v_mod, p_group, auth.uid())
    );
  end loop;
  return v_result;
end;
$$;

grant execute on function public.my_module_access(uuid) to authenticated;

-- Admin-RPC: oppdater modul-tilgang for et medlem
create or replace function public.set_member_module_access(
  p_group uuid, p_member uuid, p_module text, p_value boolean
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_group_admin(p_group) then
    raise exception 'Mangler admin-tilgang';
  end if;

  update public.group_members
    set module_access = coalesce(module_access, '{}'::jsonb)
                          || jsonb_build_object(p_module, p_value)
    where group_id = p_group and profile_id = p_member;
end;
$$;

grant execute on function public.set_member_module_access(uuid, uuid, text, boolean) to authenticated;
