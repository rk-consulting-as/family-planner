-- =====================================================================
-- Patch 0019 — Delbare invitasjonslenker med admin-godkjenning
--
-- Flyt:
--   1. Et medlem (også barn) lager en invitasjon → får en /accept/<token>-link
--   2. De deler linken via epost/SMS/melding
--   3. Mottaker klikker → registrerer seg eller logger inn → akssepterer
--   4. Hvis inviteren er admin: brukeren legges direkte til i gruppen
--      Ellers: invitasjonen havner i "venter på godkjenning"-køen, og alle
--      admins får varsel
--   5. Admin godkjenner eller avviser
-- =====================================================================

alter table public.invitations
  add column if not exists personal_message text,
  add column if not exists requires_admin_approval boolean default true,
  add column if not exists awaiting_approval_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id),
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_by uuid references public.profiles(id),
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_reason text;

-- Policies — utvid slik at vanlige medlemmer også kan opprette og se sine egne
drop policy if exists "invitations_admin_all" on public.invitations;

create policy "invitations_admin_all" on public.invitations
  for all to authenticated
  using (public.is_group_admin(group_id))
  with check (public.is_group_admin(group_id));

drop policy if exists "invitations_member_create" on public.invitations;
create policy "invitations_member_create" on public.invitations
  for insert to authenticated
  with check (
    public.is_group_member(group_id) and invited_by = auth.uid()
  );

drop policy if exists "invitations_self_read" on public.invitations;
create policy "invitations_self_read" on public.invitations
  for select to authenticated
  using (
    invited_by = auth.uid() or accepted_by = auth.uid()
  );

-- ----- RPC: hent invitasjon på token (uten auth) ---------------------
create or replace function public.get_invitation_by_token(p_token text)
returns table (
  id uuid,
  group_id uuid,
  group_name text,
  inviter_id uuid,
  inviter_name text,
  role group_role,
  personal_message text,
  expires_at timestamptz,
  accepted_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  awaiting_approval_at timestamptz
)
language sql security definer stable as $$
  select i.id, i.group_id, g.name, i.invited_by, p.display_name,
         i.role, i.personal_message, i.expires_at,
         i.accepted_at, i.approved_at, i.rejected_at, i.awaiting_approval_at
  from public.invitations i
  join public.groups g on g.id = i.group_id
  left join public.profiles p on p.id = i.invited_by
  where i.token = p_token;
$$;

grant execute on function public.get_invitation_by_token(text) to anon, authenticated;

-- ----- RPC: aksepter invitasjon (krever auth) ------------------------
create or replace function public.accept_invitation_by_token(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invitations;
  v_inviter_role group_role;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_inv from public.invitations where token = p_token;
  if v_inv.id is null then raise exception 'Ugyldig invitasjon'; end if;
  if v_inv.expires_at < now() then raise exception 'Invitasjonen er utløpt'; end if;
  if v_inv.accepted_at is not null then raise exception 'Allerede besvart'; end if;
  if v_inv.rejected_at is not null then raise exception 'Invitasjonen ble avvist'; end if;

  -- Sikre profil + notif-pref for nye brukere
  insert into public.profiles (id, display_name, email)
  select v_uid,
         coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1), 'Bruker'),
         u.email
  from auth.users u where u.id = v_uid
  on conflict (id) do nothing;

  insert into public.notification_preferences (profile_id) values (v_uid)
  on conflict (profile_id) do nothing;

  -- Hent inviterer-rolle
  select role into v_inviter_role from public.group_members
  where group_id = v_inv.group_id and profile_id = v_inv.invited_by;

  if v_inviter_role in ('owner', 'admin') and not v_inv.requires_admin_approval then
    -- Direkte godkjent — admin inviterte
    insert into public.group_members (group_id, profile_id, role)
    values (v_inv.group_id, v_uid, v_inv.role)
    on conflict (group_id, profile_id) do nothing;

    update public.invitations
      set accepted_at = now(), accepted_by = v_uid,
          approved_at = now(), approved_by = v_inv.invited_by
      where id = v_inv.id;

    return jsonb_build_object(
      'status', 'approved',
      'group_id', v_inv.group_id,
      'group_name', (select name from public.groups where id = v_inv.group_id)
    );
  else
    -- Ikke-admin inviterte — venter på godkjenning
    update public.invitations
      set accepted_at = now(), accepted_by = v_uid,
          awaiting_approval_at = now()
      where id = v_inv.id;

    -- Varsle alle admins
    insert into public.notifications (recipient_id, group_id, title, body, source_kind, source_id, link_url)
    select gm.profile_id, v_inv.group_id, 'Ny invitasjon trenger godkjenning',
           'En ny bruker venter på å bli lagt til i ' || (select name from public.groups where id = v_inv.group_id),
           'invitation', v_inv.id, '/admin/godkjenninger'
    from public.group_members gm
    where gm.group_id = v_inv.group_id and gm.role in ('owner', 'admin');

    return jsonb_build_object(
      'status', 'awaiting_approval',
      'group_id', v_inv.group_id,
      'group_name', (select name from public.groups where id = v_inv.group_id)
    );
  end if;
end;
$$;

grant execute on function public.accept_invitation_by_token(text) to authenticated;

-- ----- RPCs for admin-godkjenning ------------------------------------
create or replace function public.approve_pending_invitation(p_invitation uuid)
returns void
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_inv public.invitations;
begin
  select * into v_inv from public.invitations where id = p_invitation;
  if v_inv.id is null then raise exception 'Invitasjon finnes ikke'; end if;
  if not public.is_group_admin(v_inv.group_id) then raise exception 'Mangler tilgang'; end if;
  if v_inv.accepted_at is null then raise exception 'Ikke akseptert ennå'; end if;
  if v_inv.approved_at is not null then raise exception 'Allerede godkjent'; end if;

  insert into public.group_members (group_id, profile_id, role)
  values (v_inv.group_id, v_inv.accepted_by, v_inv.role)
  on conflict (group_id, profile_id) do nothing;

  update public.invitations
    set approved_at = now(), approved_by = auth.uid()
    where id = p_invitation;

  insert into public.notifications (recipient_id, group_id, title, body, source_kind, source_id)
  values (v_inv.accepted_by, v_inv.group_id, 'Velkommen!',
          'Du er nå med i ' || (select name from public.groups where id = v_inv.group_id),
          'invitation', v_inv.id);
end;
$$;

grant execute on function public.approve_pending_invitation(uuid) to authenticated;

create or replace function public.reject_pending_invitation(
  p_invitation uuid, p_reason text default null
) returns void
language plpgsql security definer
set search_path = public, auth
as $$
declare
  v_inv public.invitations;
begin
  select * into v_inv from public.invitations where id = p_invitation;
  if v_inv.id is null then raise exception 'Invitasjon finnes ikke'; end if;
  if not public.is_group_admin(v_inv.group_id) then raise exception 'Mangler tilgang'; end if;

  update public.invitations
    set rejected_at = now(), rejected_by = auth.uid(), rejected_reason = p_reason
    where id = p_invitation;

  if v_inv.accepted_by is not null then
    insert into public.notifications (recipient_id, group_id, title, body, source_kind, source_id)
    values (v_inv.accepted_by, v_inv.group_id, 'Invitasjon avvist',
            coalesce(p_reason, 'Forespørselen ble dessverre avvist'),
            'invitation', v_inv.id);
  end if;
end;
$$;

grant execute on function public.reject_pending_invitation(uuid, text) to authenticated;
