-- =====================================================================
-- Patch 0033 — Kassalapp-skanning
--
-- Skannet kvittering → AI-uttrekk → krysser av varer på handleliste
-- og lagrer evt. utlegg.
-- =====================================================================

create type receipt_scan_status as enum (
  'pending',     -- nettopp lastet opp, ikke prosessert
  'processing',  -- AI jobber
  'reviewed',    -- bruker har gått gjennom resultat
  'applied',     -- varer krysset av + utlegg lagret
  'failed'       -- AI kunne ikke lese
);

create table if not exists public.receipt_scans (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),

  storage_path text not null,
  public_url text,
  mime_type text,

  -- AI-uttrekk
  store_name text,
  receipt_date date,
  total_amount numeric(10,2),
  items jsonb default '[]'::jsonb,
  -- format: [{ name: "Melk 1L", quantity: 2, unit_price: 22.50, total: 45.00, matched_shopping_item_id: "..." }, ...]

  status receipt_scan_status not null default 'pending',
  error_message text,
  expense_id uuid,                       -- FK fyll inn etter expenses-tabellen er sjekket

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  reviewed_at timestamptz,
  applied_at timestamptz
);
create index if not exists idx_receipt_scans_group on public.receipt_scans (group_id, created_at desc);
create index if not exists idx_receipt_scans_status on public.receipt_scans (group_id, status);

-- RLS
alter table public.receipt_scans enable row level security;

drop policy if exists receipt_scans_select on public.receipt_scans;
create policy receipt_scans_select on public.receipt_scans
  for select using (
    exists (select 1 from public.group_members gm
            where gm.group_id = receipt_scans.group_id and gm.profile_id = auth.uid())
  );

drop policy if exists receipt_scans_insert on public.receipt_scans;
create policy receipt_scans_insert on public.receipt_scans
  for insert with check (
    uploaded_by = auth.uid()
    and exists (select 1 from public.group_members gm
                where gm.group_id = receipt_scans.group_id and gm.profile_id = auth.uid())
  );

drop policy if exists receipt_scans_modify on public.receipt_scans;
create policy receipt_scans_modify on public.receipt_scans
  for update using (
    uploaded_by = auth.uid()
    or exists (select 1 from public.group_members gm
               where gm.group_id = receipt_scans.group_id
                 and gm.profile_id = auth.uid()
                 and gm.role in ('owner', 'admin'))
  );

drop policy if exists receipt_scans_delete on public.receipt_scans;
create policy receipt_scans_delete on public.receipt_scans
  for delete using (
    uploaded_by = auth.uid()
    or exists (select 1 from public.group_members gm
               where gm.group_id = receipt_scans.group_id
                 and gm.profile_id = auth.uid()
                 and gm.role in ('owner', 'admin'))
  );
