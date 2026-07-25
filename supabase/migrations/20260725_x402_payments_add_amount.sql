-- Align existing x402_payments tables with the canonical schema.
alter table if exists x402_payments
  add column if not exists amount text;

update x402_payments
set amount = '$0.01'
where amount is null;

alter table if exists x402_payments
  alter column amount set not null;

alter table if exists x402_payments
  drop column if exists chain_id;

drop index if exists x402_payments_wallet_address_idx;

create index if not exists x402_wallet_idx
  on x402_payments (wallet_address);
