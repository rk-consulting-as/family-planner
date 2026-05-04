-- =====================================================================
-- Patch 0017 — Bryt RLS-rekursjon på chat_thread_members
--
-- Problem: ctm_member_read-policy sjekket eksistens i samme tabell, som
-- triggret samme policy → "infinite recursion detected".
--
-- Løsning: en SECURITY DEFINER-helper (is_thread_member) som leser uten
-- RLS. All medlemskaps-sjekk i chat-policyene går via denne.
-- =====================================================================

create or replace function public.is_thread_member(p_thread uuid, p_profile uuid default auth.uid())
returns boolean
language sql security definer stable as $$
  select exists(
    select 1 from public.chat_thread_members
    where thread_id = p_thread and profile_id = p_profile
  );
$$;

grant execute on function public.is_thread_member(uuid, uuid) to authenticated;

drop policy if exists "ctm_member_read" on public.chat_thread_members;
create policy "ctm_member_read" on public.chat_thread_members
  for select using (
    profile_id = auth.uid()
    or public.is_thread_member(thread_id)
    or exists(
      select 1 from public.chat_threads t
      where t.id = chat_thread_members.thread_id and public.is_group_admin(t.group_id)
    )
  );

drop policy if exists "ct_member_read" on public.chat_threads;
create policy "ct_member_read" on public.chat_threads
  for select using (
    public.is_group_admin(group_id)
    or public.is_thread_member(id)
  );

drop policy if exists "cm_thread_member_read" on public.chat_messages;
create policy "cm_thread_member_read" on public.chat_messages
  for select using (
    public.is_thread_member(thread_id)
  );

drop policy if exists "cm_thread_member_insert" on public.chat_messages;
create policy "cm_thread_member_insert" on public.chat_messages
  for insert with check (
    sender_id = auth.uid() and public.is_thread_member(thread_id)
  );
