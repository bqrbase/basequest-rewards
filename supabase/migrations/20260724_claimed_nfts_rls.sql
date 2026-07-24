-- RLS for claimed_nfts.
-- Inserts use the service-role admin client (bypasses RLS).
-- Keep RLS enabled so anon/authenticated clients cannot write directly.

alter table if exists claimed_nfts enable row level security;
