-- =====================================================================
-- Patch 0031 — Oppskriftsbase
--
-- Familiens oppskriftsbibliotek. Kan kobles til måltidsplan og handleliste.
-- =====================================================================

create type recipe_difficulty as enum ('easy', 'medium', 'hard');

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id),

  title text not null,
  description text,
  category text,                       -- "Rask middag", "Sunn mat", "Festmat" osv.
  difficulty recipe_difficulty default 'easy',

  servings int default 4,
  prep_minutes int,                    -- forberedelse
  cook_minutes int,                    -- koketid
  total_minutes int generated always as (coalesce(prep_minutes,0) + coalesce(cook_minutes,0)) stored,

  ingredients jsonb default '[]'::jsonb,
  -- format: [{ name: "Pasta", quantity: 500, unit: "g", category: "Tørrvarer" }, ...]

  instructions jsonb default '[]'::jsonb,
  -- format: ["Kok opp vann", "Tilsett salt", ...]

  hero_image_url text,                 -- hovedbilde
  source_url text,                     -- hvis importert
  ai_imported boolean default false,

  is_favorite boolean default false,
  times_planned int default 0,         -- hvor mange ganger brukt i måltidsplan

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index if not exists idx_recipes_group on public.recipes (group_id)
  where deleted_at is null;
create index if not exists idx_recipes_category on public.recipes (group_id, category)
  where deleted_at is null;
create index if not exists idx_recipes_favorite on public.recipes (group_id, is_favorite)
  where deleted_at is null and is_favorite = true;

-- Koble oppskrift til måltidsplan (tabellen heter `meals` fra 0021)
alter table public.meals
  add column if not exists recipe_id uuid references public.recipes(id) on delete set null;

-- RLS
alter table public.recipes enable row level security;

drop policy if exists recipes_select on public.recipes;
create policy recipes_select on public.recipes
  for select using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = recipes.group_id and gm.profile_id = auth.uid()
    )
  );

drop policy if exists recipes_insert on public.recipes;
create policy recipes_insert on public.recipes
  for insert with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = recipes.group_id and gm.profile_id = auth.uid()
    )
  );

drop policy if exists recipes_update on public.recipes;
create policy recipes_update on public.recipes
  for update using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = recipes.group_id and gm.profile_id = auth.uid()
    )
  );

drop policy if exists recipes_delete on public.recipes;
create policy recipes_delete on public.recipes
  for delete using (
    created_by = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.group_id = recipes.group_id
        and gm.profile_id = auth.uid()
        and gm.role in ('owner', 'admin')
    )
  );

-- Modul-tilgang
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'recipes'
  ) then
    execute 'alter publication supabase_realtime add table public.recipes';
  end if;
end $$;
