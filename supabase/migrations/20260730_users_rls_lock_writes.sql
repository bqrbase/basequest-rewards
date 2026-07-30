-- Production security: users table RLS
-- App uses NEXT_PUBLIC_SUPABASE_ANON_KEY with no Supabase Auth session.
-- XP / progress writes must go through the service-role admin client only.

alter table if exists users enable row level security;

-- Revoke direct anon/authenticated writes (forges XP if left open).
drop policy if exists "Allow anon insert users" on users;
drop policy if exists "Allow anon update users" on users;
drop policy if exists "Allow anon delete users" on users;
drop policy if exists "Allow authenticated insert users" on users;
drop policy if exists "Allow authenticated update users" on users;
drop policy if exists "Allow authenticated delete users" on users;

-- Public read for leaderboard / profile surfaces (no wallet secrets).
drop policy if exists "Allow anon select users" on users;
create policy "Allow anon select users"
  on users
  for select
  to anon
  using (true);

drop policy if exists "Allow authenticated select users" on users;
create policy "Allow authenticated select users"
  on users
  for select
  to authenticated
  using (true);

-- Explicit deny notes:
-- INSERT/UPDATE/DELETE for anon+authenticated: no policy => denied under RLS.
-- Service role bypasses RLS for /api/progress/sync and quest award paths.
