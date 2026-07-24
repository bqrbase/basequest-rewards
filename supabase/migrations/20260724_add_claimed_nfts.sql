-- Persist NFTs claimed via the Claim NFT quest.
create table if not exists claimed_nfts (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  contract_address text not null,
  token_id bigint not null,
  tx_hash text unique,
  chain_id integer not null,
  created_at timestamptz default now()
);

create index if not exists claimed_nfts_wallet_address_idx
  on claimed_nfts (wallet_address);
