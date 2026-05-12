-- =====================================================================
-- Patch 0029 — Tekstfarge på bostedsplan
--
-- Legger til text_color_hex som overstyrer auto-fargen.
-- Hvis NULL → frontend bruker color_hex med full opacity (mettet på lys bakgrunn).
-- =====================================================================

alter table public.custody_periods
  add column if not exists text_color_hex text;
