-- =====================================================================
-- Patch 0018 — Kategori og ikon på events
--
-- Lar oss bruke events-tabellen til "vanlige" kalender-innslag som ferie,
-- "hos pappa/mamma", lege, fritid osv. — uten å være knyttet til gjøremål.
-- =====================================================================

alter table public.events
  add column if not exists category text,
  add column if not exists icon text default '📅',
  add column if not exists color_hex text;

create index if not exists idx_events_category on public.events (group_id, category)
  where deleted_at is null;
