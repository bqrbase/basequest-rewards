-- Persist contracts deployed via the Deploy Contract quest.
create table if not exists deployed_contracts (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  template_id text not null,
  contract_address text not null,
  tx_hash text,
  chain_id integer not null,
  created_at timestamptz not null default now()
);

create index if not exists deployed_contracts_wallet_idx
  on deployed_contracts (wallet_address);
