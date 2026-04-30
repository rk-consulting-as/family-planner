-- =====================================================================
-- Patch 0004 — RPC for å opprette gruppe atomisk
--
-- Bakgrunn: I noen oppsett evalueres RLS-policy på 'groups' uventet under
-- INSERT fra server actions. For å gjøre opprettelsen forutsigbar bruker vi
-- en SECURITY DEFINER-funksjon som selv validerer at auth.uid() er satt og
-- gjør alt arbeidet (profil-fallback, gruppeopprettelse, eier-medlemskap)
-- i én transaksjon.
-- =====================================================================

create or replace function public.create_group_for_me(
  p_name text,
  p_type group_type default 'family',
  p_invite_code text default null
) returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_code text := coalesce(p_invite_code, upper(substring(md5(random()::text), 1, 8)));
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Sikre at profil finnes
  insert into public.profiles (id, display_name, email)
  select v_uid,
         coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1), 'Bruker'),
         u.email
  from auth.users u where u.id = v_uid
  on conflict (id) do nothing;

  insert into public.notification_preferences (profile_id) values (v_uid)
  on conflict (profile_id) do nothing;

  insert into public.groups (name, type, owner_id, invite_code)
  values (p_name, p_type, v_uid, v_code)
  returning id into v_id;

  -- add_owner_as_member-trigger gjør dette normalt; vi ekstra-sikrer
  insert into public.group_members (group_id, profile_id, role)
  values (v_id, v_uid, 'owner')
  on conflict (group_id, profile_id) do nothing;

  return v_id;
end;
$$;

grant execute on function public.create_group_for_me(text, group_type, text) to authenticated;
