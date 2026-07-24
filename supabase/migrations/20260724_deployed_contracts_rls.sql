-- Fix / verify RLS for deployed_contracts.
-- The app uses NEXT_PUBLIC_SUPABASE_ANON_KEY with no Supabase Auth session,
-- so inserts run as role `anon`. If RLS is enabled without an insert policy,
-- PostgREST returns: code 42501 / "new row violates row-level security policy".

alter table if exists deployed_contracts enable row level security;

drop policy if exists "Allow anon insert deployed_contracts" on deployed_contracts;
create policy "Allow anon insert deployed_contracts"
  on deployed_contracts
  for insert
  to anon
  with check (true);

drop policy if exists "Allow anon select deployed_contracts" on deployed_contracts;
create policy "Allow anon select deployed_contracts"
  on deployed_contracts
  for select
  to anon
  using (true);

-- Optional: allow authenticated role the same access if Auth is added later.
drop policy if exists "Allow authenticated insert deployed_contracts" on deployed_contracts;
create policy "Allow authenticated insert deployed_contracts"
  on deployed_contracts
  for insert
  to authenticated
  with check (true);

drop policy if exists "Allow authenticated select deployed_contracts" on deployed_contracts;
create policy "Allow authenticated select deployed_contracts"
  on deployed_contracts
  for select
  to authenticated
  using (true);
