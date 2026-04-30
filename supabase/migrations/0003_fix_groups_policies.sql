-- =====================================================================
-- Patch 0003 — Eksplisitte policies på groups-tabellen
--
-- Bakgrunn: I noen tilfeller blir den opprinnelige insert-policyen ikke
-- evaluert riktig (typisk når 'to authenticated' mangler). Vi dropper og
-- gjenoppretter alle groups-policies med eksplisitt rolle-mål.
-- =====================================================================

drop policy if exists "groups_member_read" on public.groups;
drop policy if exists "groups_authenticated_insert" on public.groups;
drop policy if exists "groups_owner_update" on public.groups;
drop policy if exists "groups_owner_delete" on public.groups;

create policy "groups_member_read" on public.groups
  for select using (public.is_group_member(id));

create policy "groups_authenticated_insert" on public.groups
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "groups_owner_update" on public.groups
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "groups_owner_delete" on public.groups
  for delete to authenticated
  using (owner_id = auth.uid());
