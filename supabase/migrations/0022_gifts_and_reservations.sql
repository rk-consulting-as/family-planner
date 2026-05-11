-- =====================================================================
-- Patch 0022 — Gave-ønskelister med spleising
--
-- Datamodell:
--   gift_lists       — én ønskeliste per anledning per person
--   gift_items       — enkeltgaver: tittel, lenke, bilde, pris, prioritet
--   gift_reservations — reservasjoner: kan være skjult for eier (overraskelse!)
--                       og flere kan reservere samme gave (spleising)
--
-- RLS-prinsipp:
--   Eier ser ALLTID sin egen liste, men SKAL IKKE se reservasjoner som er
--   merket hidden_from_owner = true (overraskelser).
--   Andre familiemedlemmer ser alle reservasjoner.
-- =====================================================================

create type gift_priority as enum ('low', 'normal', 'high', 'must_have');

create table if not exists public.gift_lists (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  occasion text,                       -- 'birthday','christmas','confirmation','annet'
  occasion_date date,
  description text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_gl_group_owner on public.gift_lists (group_id, owner_id, is_active);

create table if not exists public.gift_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.gift_lists(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  description text,
  url text,
  image_url text,
  price numeric(10, 2),
  priority gift_priority default 'normal',
  category text,
  notes_for_buyer text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_gi_list on public.gift_items (list_id);

create table if not exists public.gift_reservations (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references public.gift_items(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  reserved_by uuid not null references public.profiles(id) on delete cascade,
  hidden_from_owner boolean default true, -- skjult for eier (overraskelse)
  amount_contributing numeric(10, 2),     -- for spleising — hva denne personen bidrar med
  note text,
  created_at timestamptz default now(),
  unique (gift_id, reserved_by)
);
create index if not exists idx_gr_gift on public.gift_reservations (gift_id);
create index if not exists idx_gr_user on public.gift_reservations (reserved_by);

drop trigger if exists trg_gl_updated on public.gift_lists;
create trigger trg_gl_updated before update on public.gift_lists
  for each row execute function public.set_updated_at();

drop trigger if exists trg_gi_updated on public.gift_items;
create trigger trg_gi_updated before update on public.gift_items
  for each row execute function public.set_updated_at();

-- RLS ----------------------------------------------------------------
alter table public.gift_lists enable row level security;
alter table public.gift_items enable row level security;
alter table public.gift_reservations enable row level security;

drop policy if exists "gl_member_read" on public.gift_lists;
create policy "gl_member_read" on public.gift_lists
  for select using (public.is_group_member(group_id));

drop policy if exists "gl_owner_or_admin_write" on public.gift_lists;
create policy "gl_owner_or_admin_write" on public.gift_lists
  for all using (
    owner_id = auth.uid() or public.is_group_admin(group_id)
  ) with check (
    owner_id = auth.uid() or public.is_group_admin(group_id)
  );

drop policy if exists "gi_member_read" on public.gift_items;
create policy "gi_member_read" on public.gift_items
  for select using (public.is_group_member(group_id));

drop policy if exists "gi_owner_or_admin_write" on public.gift_items;
create policy "gi_owner_or_admin_write" on public.gift_items
  for all using (
    public.is_group_member(group_id) and exists (
      select 1 from public.gift_lists gl
      where gl.id = gift_items.list_id
        and (gl.owner_id = auth.uid() or public.is_group_admin(gl.group_id))
    )
  ) with check (
    public.is_group_member(group_id) and exists (
      select 1 from public.gift_lists gl
      where gl.id = gift_items.list_id
        and (gl.owner_id = auth.uid() or public.is_group_admin(gl.group_id))
    )
  );

-- Reservasjoner: alle medlemmer kan opprette + se andres,
-- MEN eieren av lista ser IKKE reservasjoner som er hidden_from_owner=true
drop policy if exists "gr_member_read" on public.gift_reservations;
create policy "gr_member_read" on public.gift_reservations
  for select using (
    public.is_group_member(group_id)
    and (
      reserved_by = auth.uid()        -- min egen reservasjon ser jeg alltid
      or hidden_from_owner = false    -- åpne reservasjoner ser alle
      or not exists (                 -- skjulte: ingen ser dem hvis du er eieren
        select 1 from public.gift_items gi
        join public.gift_lists gl on gl.id = gi.list_id
        where gi.id = gift_reservations.gift_id
          and gl.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "gr_member_create" on public.gift_reservations;
create policy "gr_member_create" on public.gift_reservations
  for insert with check (
    reserved_by = auth.uid() and public.is_group_member(group_id)
  );

drop policy if exists "gr_self_update" on public.gift_reservations;
create policy "gr_self_update" on public.gift_reservations
  for update using (reserved_by = auth.uid())
  with check (reserved_by = auth.uid());

drop policy if exists "gr_self_delete" on public.gift_reservations;
create policy "gr_self_delete" on public.gift_reservations
  for delete using (reserved_by = auth.uid());
