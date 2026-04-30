-- =====================================================================
-- Patch 0002 — La autentiserte brukere opprette egen profil-rad
--
-- Bakgrunn: handle_new_user-trigger oppretter normalt profilen automatisk.
-- Når brukere opprettes via Supabase admin-panel ("Add user") fyrer
-- triggeren ikke alltid, og vi får en bruker uten profil. Etter denne
-- patchen kan klienten selv opprette profilen via upsert (med id = auth.uid()).
-- =====================================================================

create policy "profiles_self_insert" on public.profiles
  for insert with check (id = auth.uid());

-- Backfill profiler for alle eksisterende auth.users som mangler en
insert into public.profiles (id, display_name, email)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1), 'Bruker'),
  u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- Backfill notification_preferences
insert into public.notification_preferences (profile_id)
select p.id from public.profiles p
left join public.notification_preferences np on np.profile_id = p.id
where np.profile_id is null;
