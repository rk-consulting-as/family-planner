-- =====================================================================
-- Patch 0014 — Lås utlegg når perioden er avsluttet
--
-- RLS sikrer at selv om noen omgår applikasjonen, kan utlegg som er
-- knyttet til en lukket periode ikke endres eller slettes.
-- =====================================================================

drop policy if exists "exp_member_write" on public.expenses;
drop policy if exists "exp_member_insert" on public.expenses;
drop policy if exists "exp_member_update" on public.expenses;
drop policy if exists "exp_member_delete" on public.expenses;

-- Innsetting: kun grupp-medlem, og perioden må være åpen
create policy "exp_member_insert" on public.expenses
  for insert with check (
    public.is_group_member(group_id)
    and exists (
      select 1 from public.expense_periods ep
      where ep.id = expenses.period_id and ep.status = 'open'
    )
  );

-- Oppdatering: bare hvis perioden fortsatt er åpen
create policy "exp_member_update" on public.expenses
  for update using (
    public.is_group_member(group_id)
    and exists (
      select 1 from public.expense_periods ep
      where ep.id = expenses.period_id and ep.status = 'open'
    )
  ) with check (
    public.is_group_member(group_id)
    and exists (
      select 1 from public.expense_periods ep
      where ep.id = expenses.period_id and ep.status = 'open'
    )
  );

-- Sletting (DELETE) — vi bruker soft-delete via update, men lar admins
-- gjøre hard delete hvis nødvendig — også kun mens periode er åpen.
create policy "exp_admin_delete" on public.expenses
  for delete using (
    public.is_group_admin(group_id)
    and exists (
      select 1 from public.expense_periods ep
      where ep.id = expenses.period_id and ep.status = 'open'
    )
  );
