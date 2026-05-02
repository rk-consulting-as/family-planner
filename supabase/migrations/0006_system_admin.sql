-- =====================================================================
-- Patch 0006 — System administrator-rolle
--
-- Legger til "super admin" på tvers av alle grupper. En system_admin kan
-- se og endre alt — nyttig for support, debugging og backoffice.
--
-- Sikkerhet: flagget settes via SQL eller via set_system_admin() som
-- selv krever at oppringer er system_admin. Første admin må settes manuelt.
-- =====================================================================

alter table public.profiles add column if not exists is_system_admin boolean default false;

create or replace function public.is_system_admin(p_profile uuid default auth.uid())
returns boolean
language sql security definer stable as $$
  select coalesce(
    (select is_system_admin from public.profiles where id = p_profile),
    false
  );
$$;

create or replace function public.is_group_member(p_group uuid, p_profile uuid default auth.uid())
returns boolean
language sql security definer stable as $$
  select
    public.is_system_admin(p_profile)
    or exists(
      select 1 from public.group_members
      where group_id = p_group and profile_id = p_profile
    );
$$;

create or replace function public.is_group_admin(p_group uuid, p_profile uuid default auth.uid())
returns boolean
language sql security definer stable as $$
  select
    public.is_system_admin(p_profile)
    or exists(
      select 1 from public.group_members
      where group_id = p_group
        and profile_id = p_profile
        and role in ('owner','admin')
    );
$$;

create or replace function public.admin_list_all_groups()
returns table (
  id uuid, name text, type group_type, invite_code text,
  owner_id uuid, owner_name text, member_count bigint,
  chore_count bigint, created_at timestamptz
)
language sql security definer stable as $$
  select
    g.id, g.name, g.type, g.invite_code, g.owner_id,
    p.display_name as owner_name,
    (select count(*) from public.group_members gm where gm.group_id = g.id) as member_count,
    (select count(*) from public.chores c where c.group_id = g.id and c.deleted_at is null) as chore_count,
    g.created_at
  from public.groups g
  left join public.profiles p on p.id = g.owner_id
  where g.deleted_at is null
    and public.is_system_admin();
$$;

create or replace function public.admin_list_all_users()
returns table (
  id uuid, display_name text, email text, is_system_admin boolean,
  group_count bigint, created_at timestamptz
)
language sql security definer stable as $$
  select
    p.id, p.display_name, p.email, p.is_system_admin,
    (select count(*) from public.group_members gm where gm.profile_id = p.id) as group_count,
    p.created_at
  from public.profiles p
  where public.is_system_admin();
$$;

create or replace function public.set_system_admin(p_target uuid, p_value boolean)
returns void
language plpgsql security definer
set search_path = public, auth
as $$
begin
  if not public.is_system_admin() then
    raise exception 'Only system admins can change this flag';
  end if;
  update public.profiles set is_system_admin = p_value where id = p_target;
end;
$$;

grant execute on function public.is_system_admin(uuid) to authenticated;
grant execute on function public.admin_list_all_groups() to authenticated;
grant execute on function public.admin_list_all_users() to authenticated;
grant execute on function public.set_system_admin(uuid, boolean) to authenticated;
