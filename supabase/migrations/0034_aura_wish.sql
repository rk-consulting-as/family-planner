-- =====================================================================
-- Patch 0034 — Aura Wish (selvstendig modul)
--
-- Sosial ønskelisteapp inspirert av Stitch-design.
-- Helt egne tabeller (prefixet "aura_") slik at modulen kan flyttes til
-- en standalone Next-app senere uten datamigrering.
--
-- Sosialt nettverk: brukere følger hverandre asymmetrisk.
-- Lister kan være private / venner / offentlige.
-- Reservasjoner skjules for ønske-eier (overraskelses-modell).
-- =====================================================================

create type aura_list_visibility as enum ('private', 'friends', 'public');
create type aura_wish_status as enum ('open', 'reserved', 'fulfilled', 'archived');
create type aura_wish_priority as enum ('low', 'normal', 'high', 'must_have');
create type aura_friendship_status as enum ('pending', 'accepted', 'blocked');
create type aura_activity_kind as enum (
  'wish_added',
  'wish_reserved',
  'wish_fulfilled',
  'list_created',
  'list_shared',
  'price_drop',
  'friend_request',
  'friend_accepted',
  'wish_liked'
);

-- =====================================================================
-- Profil-utvidelser for Aura (kobles til eksisterende profiles)
-- =====================================================================
create table if not exists public.aura_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  username text unique,                              -- @amalie_wishes
  bio text,
  is_public boolean default true,                    -- profilen kan oppdages
  push_notifications boolean default true,
  language text default 'nb',
  theme text default 'light' check (theme in ('light', 'dark', 'system')),
  follower_count int default 0,
  following_count int default 0,
  wish_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_aura_profiles_username on public.aura_profiles (username)
  where username is not null;

-- =====================================================================
-- Ønskelister
-- =====================================================================
create table if not exists public.aura_wishlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,                               -- "Bursdag 2024"
  description text,
  cover_image_url text,
  occasion text,                                     -- 'birthday', 'christmas', 'wedding', 'other'
  occasion_date date,
  visibility aura_list_visibility not null default 'friends',
  featured_wish_id uuid,                             -- FK fyll inn etter aura_wishes
  is_archived boolean default false,
  wish_count int default 0,                          -- denormalisert
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index if not exists idx_aura_wishlists_owner on public.aura_wishlists (owner_id)
  where deleted_at is null and is_archived = false;
create index if not exists idx_aura_wishlists_visibility on public.aura_wishlists (visibility, owner_id)
  where deleted_at is null;

-- =====================================================================
-- Ønsker (produkter)
-- =====================================================================
create table if not exists public.aura_wishes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  list_id uuid references public.aura_wishlists(id) on delete set null,

  title text not null,                               -- "Handball Spezial sneakers"
  description text,
  brand text,                                        -- "Adidas"
  category text,                                     -- "Sneakers", "Smykker"

  -- Hovedbilde + opp til 4 ekstra
  hero_image_url text,
  extra_image_urls text[] default '{}',

  -- Prisinformasjon
  price numeric(10, 2),
  original_price numeric(10, 2),
  currency text default 'NOK',
  on_sale boolean default false,

  -- Produktdata (kan hentes fra URL via AI)
  product_url text,                                  -- primær lenke
  alt_stores jsonb default '[]'::jsonb,
  -- [{ name: "Amazon", url: "...", price: 110.00, in_stock: true }, ...]

  details jsonb default '{}'::jsonb,
  -- { color: "Navy / Blue Dawn", size: "42", model: "..." }

  notes text,                                        -- "Helst i blå"
  priority aura_wish_priority not null default 'normal',
  status aura_wish_status not null default 'open',

  ai_enriched boolean default false,
  source_url text,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index if not exists idx_aura_wishes_owner on public.aura_wishes (owner_id) where deleted_at is null;
create index if not exists idx_aura_wishes_list on public.aura_wishes (list_id) where deleted_at is null;
create index if not exists idx_aura_wishes_status on public.aura_wishes (status) where deleted_at is null;
create index if not exists idx_aura_wishes_category on public.aura_wishes (category) where deleted_at is null;

-- Nå kan vi koble featured_wish
alter table public.aura_wishlists
  drop constraint if exists aura_wishlists_featured_fk;
alter table public.aura_wishlists
  add constraint aura_wishlists_featured_fk
  foreign key (featured_wish_id) references public.aura_wishes(id) on delete set null;

-- =====================================================================
-- Reservasjoner (skjules for ønske-eier)
-- =====================================================================
create table if not exists public.aura_reservations (
  id uuid primary key default gen_random_uuid(),
  wish_id uuid not null references public.aura_wishes(id) on delete cascade,
  reserver_id uuid not null references public.profiles(id) on delete cascade,
  message text,                                      -- privat melding mellom giver og medbestiller
  fulfilled_at timestamptz,
  created_at timestamptz default now(),
  unique (wish_id, reserver_id)
);
create index if not exists idx_aura_reservations_wish on public.aura_reservations (wish_id);

-- =====================================================================
-- Vennskap (asymmetrisk: følge-relasjon)
-- =====================================================================
create table if not exists public.aura_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status aura_friendship_status not null default 'pending',
  shared_circles text[] default '{}',                -- ["Kollegaer", "Skole"]
  responded_at timestamptz,
  created_at timestamptz default now(),
  unique (requester_id, recipient_id),
  check (requester_id <> recipient_id)
);
create index if not exists idx_aura_friendships_requester on public.aura_friendships (requester_id, status);
create index if not exists idx_aura_friendships_recipient on public.aura_friendships (recipient_id, status);

-- =====================================================================
-- Followed brands (egne merker brukeren følger)
-- =====================================================================
create table if not exists public.aura_brand_follows (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  brand_slug text not null,                          -- "nike", "apple", "lego"
  created_at timestamptz default now(),
  primary key (profile_id, brand_slug)
);

-- =====================================================================
-- Activity feed
-- =====================================================================
create table if not exists public.aura_activities (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade,
  kind aura_activity_kind not null,

  -- Polymorphic refs (sett kun det som er relevant)
  wish_id uuid references public.aura_wishes(id) on delete cascade,
  list_id uuid references public.aura_wishlists(id) on delete cascade,

  metadata jsonb default '{}'::jsonb,                -- f.eks. {"old_price": 145, "new_price": 120}
  read_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_aura_activities_recipient on public.aura_activities (recipient_id, created_at desc);
create index if not exists idx_aura_activities_actor on public.aura_activities (actor_id, created_at desc);

-- =====================================================================
-- Likes / inspirasjon-tracking
-- =====================================================================
create table if not exists public.aura_wish_likes (
  wish_id uuid not null references public.aura_wishes(id) on delete cascade,
  liker_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (wish_id, liker_id)
);
create index if not exists idx_aura_wish_likes_liker on public.aura_wish_likes (liker_id, created_at desc);

-- =====================================================================
-- Hjelpefunksjon: er to brukere venner?
-- =====================================================================
create or replace function public.aura_are_friends(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.aura_friendships
    where status = 'accepted'
      and (
        (requester_id = p_a and recipient_id = p_b) or
        (requester_id = p_b and recipient_id = p_a)
      )
  );
$$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.aura_profiles enable row level security;
alter table public.aura_wishlists enable row level security;
alter table public.aura_wishes enable row level security;
alter table public.aura_reservations enable row level security;
alter table public.aura_friendships enable row level security;
alter table public.aura_brand_follows enable row level security;
alter table public.aura_activities enable row level security;
alter table public.aura_wish_likes enable row level security;

-- aura_profiles
drop policy if exists aura_profiles_select on public.aura_profiles;
create policy aura_profiles_select on public.aura_profiles
  for select using (is_public or profile_id = auth.uid() or public.aura_are_friends(profile_id, auth.uid()));

drop policy if exists aura_profiles_modify on public.aura_profiles;
create policy aura_profiles_modify on public.aura_profiles
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- aura_wishlists
drop policy if exists aura_wishlists_select on public.aura_wishlists;
create policy aura_wishlists_select on public.aura_wishlists
  for select using (
    deleted_at is null
    and (
      owner_id = auth.uid()
      or visibility = 'public'
      or (visibility = 'friends' and public.aura_are_friends(owner_id, auth.uid()))
    )
  );

drop policy if exists aura_wishlists_modify on public.aura_wishlists;
create policy aura_wishlists_modify on public.aura_wishlists
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- aura_wishes
drop policy if exists aura_wishes_select on public.aura_wishes;
create policy aura_wishes_select on public.aura_wishes
  for select using (
    deleted_at is null
    and (
      owner_id = auth.uid()
      or exists (
        select 1 from public.aura_wishlists l
        where l.id = aura_wishes.list_id and l.deleted_at is null and (
          l.visibility = 'public'
          or (l.visibility = 'friends' and public.aura_are_friends(l.owner_id, auth.uid()))
        )
      )
    )
  );

drop policy if exists aura_wishes_modify on public.aura_wishes;
create policy aura_wishes_modify on public.aura_wishes
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- aura_reservations — viktig: skjul for ønske-eier
drop policy if exists aura_reservations_select on public.aura_reservations;
create policy aura_reservations_select on public.aura_reservations
  for select using (
    reserver_id = auth.uid()
    or exists (
      -- venner kan se reservasjoner UNNTATT eieren av wish-en
      select 1 from public.aura_wishes w
      where w.id = aura_reservations.wish_id
        and w.owner_id <> auth.uid()
        and (
          public.aura_are_friends(w.owner_id, auth.uid())
          or public.aura_are_friends(aura_reservations.reserver_id, auth.uid())
        )
    )
  );

drop policy if exists aura_reservations_modify on public.aura_reservations;
create policy aura_reservations_modify on public.aura_reservations
  for all using (reserver_id = auth.uid()) with check (reserver_id = auth.uid());

-- aura_friendships
drop policy if exists aura_friendships_select on public.aura_friendships;
create policy aura_friendships_select on public.aura_friendships
  for select using (requester_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists aura_friendships_insert on public.aura_friendships;
create policy aura_friendships_insert on public.aura_friendships
  for insert with check (requester_id = auth.uid());

drop policy if exists aura_friendships_update on public.aura_friendships;
create policy aura_friendships_update on public.aura_friendships
  for update using (recipient_id = auth.uid() or requester_id = auth.uid());

drop policy if exists aura_friendships_delete on public.aura_friendships;
create policy aura_friendships_delete on public.aura_friendships
  for delete using (requester_id = auth.uid() or recipient_id = auth.uid());

-- aura_brand_follows
drop policy if exists aura_brand_follows_modify on public.aura_brand_follows;
create policy aura_brand_follows_modify on public.aura_brand_follows
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- aura_activities
drop policy if exists aura_activities_select on public.aura_activities;
create policy aura_activities_select on public.aura_activities
  for select using (recipient_id = auth.uid() or actor_id = auth.uid());

drop policy if exists aura_activities_insert on public.aura_activities;
create policy aura_activities_insert on public.aura_activities
  for insert with check (actor_id = auth.uid());

-- aura_wish_likes
drop policy if exists aura_wish_likes_select on public.aura_wish_likes;
create policy aura_wish_likes_select on public.aura_wish_likes
  for select using (true);

drop policy if exists aura_wish_likes_modify on public.aura_wish_likes;
create policy aura_wish_likes_modify on public.aura_wish_likes
  for all using (liker_id = auth.uid()) with check (liker_id = auth.uid());

-- =====================================================================
-- Triggere: oppdater wish_count + autoenrich aktivitet
-- =====================================================================
create or replace function public.aura_update_wishlist_count()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    if new.list_id is not null then
      update public.aura_wishlists
        set wish_count = wish_count + 1, updated_at = now()
        where id = new.list_id;
    end if;
  elsif (tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.list_id is distinct from new.list_id)) then
    if old.list_id is not null then
      update public.aura_wishlists
        set wish_count = greatest(0, wish_count - 1), updated_at = now()
        where id = old.list_id;
    end if;
    if tg_op = 'UPDATE' and new.list_id is not null then
      update public.aura_wishlists
        set wish_count = wish_count + 1, updated_at = now()
        where id = new.list_id;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_aura_wish_count on public.aura_wishes;
create trigger trg_aura_wish_count
  after insert or update or delete on public.aura_wishes
  for each row execute function public.aura_update_wishlist_count();

-- Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'aura_wishes'
  ) then
    execute 'alter publication supabase_realtime add table public.aura_wishes';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'aura_reservations'
  ) then
    execute 'alter publication supabase_realtime add table public.aura_reservations';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'aura_activities'
  ) then
    execute 'alter publication supabase_realtime add table public.aura_activities';
  end if;
end $$;
