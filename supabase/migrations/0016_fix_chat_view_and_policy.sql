-- =====================================================================
-- Patch 0016 — Fiks for chat-tråd som returnerer 404
--
-- Problem: my_chat_threads-viewet brukte standard SECURITY DEFINER (owner-
-- evaluering) som ikke fungerer med auth.uid() i RLS. Også: parentes-
-- presedens i ct_member_read-policyen kunne lese feil i noen drivers.
-- =====================================================================

drop view if exists public.my_chat_threads;

create view public.my_chat_threads
with (security_invoker = on)
as
select
  t.id, t.group_id, t.kind, t.name, t.created_by, t.created_at, t.last_message_at,
  ctm.last_read_at,
  (select count(*) from public.chat_messages m
   where m.thread_id = t.id
     and m.deleted_at is null
     and m.sender_id <> auth.uid()
     and (ctm.last_read_at is null or m.created_at > ctm.last_read_at)) as unread_count
from public.chat_threads t
join public.chat_thread_members ctm on ctm.thread_id = t.id
where ctm.profile_id = auth.uid();

grant select on public.my_chat_threads to authenticated;

-- Eksplisitte parenteser for å unngå tvetydighet med operator-presedens
drop policy if exists "ct_member_read" on public.chat_threads;
create policy "ct_member_read" on public.chat_threads
  for select using (
    public.is_group_admin(group_id)
    or (
      public.is_group_member(group_id)
      and exists(
        select 1 from public.chat_thread_members ctm
        where ctm.thread_id = chat_threads.id and ctm.profile_id = auth.uid()
      )
    )
  );
