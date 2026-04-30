-- =====================================================================
-- Patch 0005 — RPC for å bli med i gruppe via invitasjonskode
--
-- Bakgrunn: RLS på 'groups' krever at brukeren er medlem for å lese raden.
-- Det skaper en chicken-and-egg når en ny bruker prøver å slå opp en kode.
-- Vi løser det med en SECURITY DEFINER-funksjon som leser uten RLS, oppretter
-- profil hvis den mangler, og legger brukeren til som medlem atomisk.
-- =====================================================================

create or replace function public.join_group_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select id into v_group_id
  from public.groups
  where invite_code = upper(p_code)
    and deleted_at is null;

  if v_group_id is null then
    raise exception 'Fant ikke gruppe med den koden';
  end if;

  insert into public.profiles (id, display_name, email)
  select v_uid,
         coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1), 'Bruker'),
         u.email
  from auth.users u where u.id = v_uid
  on conflict (id) do nothing;

  insert into public.notification_preferences (profile_id) values (v_uid)
  on conflict (profile_id) do nothing;

  insert into public.group_members (group_id, profile_id, role)
  values (v_group_id, v_uid, 'member')
  on conflict (group_id, profile_id) do nothing;

  return v_group_id;
end;
$$;

grant execute on function public.join_group_by_code(text) to authenticated;
