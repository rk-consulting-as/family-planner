-- =====================================================================
-- Patch 0021 — Måltidsplan + handleliste
-- =====================================================================

create type meal_slot as enum ('breakfast', 'lunch', 'dinner', 'snack');

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  date date not null,
  slot meal_slot not null default 'dinner',
  title text not null,
  recipe_url text,
  notes text,
  icon text default '🍽️',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_meals_group_date on public.meals (group_id, date);

drop trigger if exists trg_meals_updated on public.meals;
create trigger trg_meals_updated before update on public.meals
  for each row execute function public.set_updated_at();

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  name text not null,
  quantity text,                  -- "2", "500g", "en pakke"
  category text default 'annet',  -- frukt, meieri, kjøtt, kjøl, frys, tørrvarer, annet
  notes text,
  added_by uuid not null references public.profiles(id),
  is_purchased boolean default false,
  purchased_by uuid references public.profiles(id),
  purchased_at timestamptz,
  source_meal_id uuid references public.meals(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists idx_sli_group on public.shopping_list_items (group_id, is_purchased);

alter table public.meals enable row level security;
alter table public.shopping_list_items enable row level security;

drop policy if exists "meals_member_read" on public.meals;
create policy "meals_member_read" on public.meals
  for select using (public.is_group_member(group_id));

drop policy if exists "meals_member_write" on public.meals;
create policy "meals_member_write" on public.meals
  for all using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

drop policy if exists "sli_member_read" on public.shopping_list_items;
create policy "sli_member_read" on public.shopping_list_items
  for select using (public.is_group_member(group_id));

drop policy if exists "sli_member_write" on public.shopping_list_items;
create policy "sli_member_write" on public.shopping_list_items
  for all using (public.is_group_member(group_id))
  with check (public.is_group_member(group_id));

-- Realtime for handleliste (slik at flere kan handle samtidig)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'shopping_list_items'
  ) then
    alter publication supabase_realtime add table public.shopping_list_items;
  end if;
end$$;
