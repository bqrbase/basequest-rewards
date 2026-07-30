-- Production security: deployed_contracts inserts must not be open to anon.
-- The app persists deploys via service-role /api/contracts/save only.

alter table if exists deployed_contracts enable row level security;

drop policy if exists "Allow anon insert deployed_contracts" on deployed_contracts;
drop policy if exists "Allow authenticated insert deployed_contracts" on deployed_contracts;

-- Keep public read for transparency / debugging of deploy quests.
drop policy if exists "Allow anon select deployed_contracts" on deployed_contracts;
create policy "Allow anon select deployed_contracts"
  on deployed_contracts
  for select
  to anon
  using (true);

drop policy if exists "Allow authenticated select deployed_contracts" on deployed_contracts;
create policy "Allow authenticated select deployed_contracts"
  on deployed_contracts
  for select
  to authenticated
  using (true);
