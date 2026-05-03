-- =====================================================================
-- Patch 0011 — Tid på gjøremål + invitasjoner
--
-- Endringer:
--   chores.scheduled_start / scheduled_end  → vises i kalenderen som blokk.
--   chore_invitations                       → "Vil du gjøre dette sammen?"
--                                              med pending/accepted/declined.
--
-- Flyt:
--   1. Bruker klikker i kalenderen → velger "Gjøremål" → fyller inn skjema.
--   2. Andre tildelte (utenom seg selv) får invitasjon hvis du IKKE er admin.
--      Admin kan tildele direkte uten godkjenning.
--   3. Mottaker får varsling, kan akseptere/avslå.
--      Aksept → legges til i chores.assignee_ids.
--      Avslå  → fjernes fra invitasjon, ingen endring i chores.
-- =====================================================================

alter table public.chores
  add column if not exists scheduled_start timestamptz,
  add column if not exists scheduled_end timestamptz;

create index if not exists idx_chores_scheduled
  on public.chores (group_id, scheduled_start)
  where deleted_at is null and scheduled_start is not null;

-- Invitasjoner --------------------------------------------------------
create type chore_invitation_status as enum ('pending', 'accepted', 'declined', 'expired');

create table public.chore_invitations (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null references public.chores(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  invited_user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id),
  message text,
  status chore_invitation_status not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz default now(),
  unique (chore_id, invited_user_id)
);
create index idx_ci_user_status on public.chore_invitations (invited_user_id, status);
create index idx_ci_group on public.chore_invitations (group_id);

alter table public.chore_invitations enable row level security;

create policy "ci_read_involved" on public.chore_invitations
  for select using (
    invited_user_id = auth.uid()
    or invited_by = auth.uid()
    or public.is_group_admin(group_id)
  );

create policy "ci_insert_member" on public.chore_invitations
  for insert with check (
    public.is_group_member(group_id) and invited_by = auth.uid()
  );

create policy "ci_update_self_or_admin" on public.chore_invitations
  for update using (
    invited_user_id = auth.uid() or public.is_group_admin(group_id)
  );

-- Respond-RPC: aksepter eller avslå --------------------------------------
create or replace function public.respond_chore_invitation(
  p_invitation uuid, p_decision chore_invitation_status
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  r public.chore_invitations;
begin
  if p_decision not in ('accepted', 'declined') then
    raise exception 'Decision must be accepted or declined';
  end if;

  select * into r from public.chore_invitations where id = p_invitation;
  if r is null then raise exception 'Invitasjon finnes ikke'; end if;
  if r.invited_user_id <> auth.uid() then
    raise exception 'Bare mottaker kan svare';
  end if;
  if r.status <> 'pending' then
    raise exception 'Allerede besvart';
  end if;

  update public.chore_invitations
    set status = p_decision, responded_at = now()
    where id = p_invitation;

  if p_decision = 'accepted' then
    -- Legg til i assignee_ids hvis ikke allerede der
    update public.chores
      set assignee_ids = array(
        select distinct unnest(coalesce(assignee_ids, '{}'::uuid[]) || array[r.invited_user_id])
      )
      where id = r.chore_id;

    -- Varsle den som inviterte
    insert into public.notifications (recipient_id, group_id, title, body, source_kind, source_id)
    values (r.invited_by, r.group_id, 'Invitasjon akseptert',
            'Noen takket ja til å gjøre oppgaven med deg', 'chore_invitation', r.id);
  else
    insert into public.notifications (recipient_id, group_id, title, body, source_kind, source_id)
    values (r.invited_by, r.group_id, 'Invitasjon avslått',
            'Mottaker takket nei', 'chore_invitation', r.id);
  end if;
end;
$$;

grant execute on function public.respond_chore_invitation(uuid, chore_invitation_status) to authenticated;
