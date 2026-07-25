create table if not exists x402_payments (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  tx_hash text unique not null,
  amount text not null,
  network text not null,
  created_at timestamptz default now()
);

create index if not exists x402_wallet_idx
  on x402_payments (wallet_address);

alter table if exists x402_payments enable row level security;
