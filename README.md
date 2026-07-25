# BaseQuest Rewards

Daily rewards and engagement mini app for the Base ecosystem.

**Production:** [https://basequest-rewards.vercel.app](https://basequest-rewards.vercel.app)

**Network:** Base Mainnet (`chainId` 8453) only.

## Tech stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- OnchainKit + wagmi
- Supabase
- Hardhat (contract deploys to Base Mainnet)

## Prerequisites

- Node.js 20+
- npm
- A Supabase project
- An OnchainKit API key
- A WalletConnect Cloud Project ID (required in production)

## Setup

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Copy the environment template:

```bash
cp .env.example .env.local
```

3. Fill in `.env.local` using the variables in `.env.example`. For local development against production-shaped config, set at minimum:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase service role key |
| `NEXT_PUBLIC_ONCHAINKIT_API_KEY` | Coinbase Developer Platform OnchainKit key |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud Project ID |
| `NEXT_PUBLIC_APP_URL` | Public app URL (`https://basequest-rewards.vercel.app` in production) |
| `NEXT_PUBLIC_BASEQUEST_BADGE_ADDRESS` | BaseQuest Builder Badge contract on Base Mainnet |

Also configure server-only keys for X OAuth, Neynar (Farcaster), and x402 / CDP as listed in `.env.example`.

4. Create the Supabase tables.

**`users` table:**

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique not null,
  total_xp integer not null default 0,
  streak integer not null default 0,
  last_checkin date,
  completed_quests jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

**`quests` table:**

```sql
create table quests (
  id text primary key,
  title text not null,
  description text not null,
  reward_xp integer not null default 0,
  status text not null default 'active',
  display_order integer not null default 0,
  enabled boolean not null default true
);
```

Apply additional migrations under `supabase/migrations/` for X follow columns, `deployed_contracts`, `claimed_nfts`, and `x402_payments`.

5. Configure Supabase Row Level Security before production. At minimum:

- Allow public read on `quests` where `enabled = true`
- Allow authenticated/anon read on `users` for leaderboard/profile
- Restrict `users` inserts/updates to the connected wallet row
- Use the service-role key only on the server for privileged inserts

6. Seed quest data (optional if using Supabase quest catalog):

```sql
insert into quests (id, title, description, reward_xp, status, display_order, enabled)
values
  ('daily-check-in', 'Daily Check-in', 'Check in once per day to earn rewards and keep your streak alive.', 10, 'active', 1, true),
  ('view-leaderboard', 'View Leaderboard', 'Open the leaderboard for the first time.', 25, 'active', 2, true),
  ('build-streak', 'Build Your Streak', 'Return daily to grow your streak and unlock bonus engagement rewards.', 5, 'active', 3, true),
  ('explore-base', 'Explore Base Apps', 'Discover popular apps in the Base ecosystem and earn bonus XP.', 15, 'active', 4, true),
  ('follow-x', 'Follow us on X', 'Follow @bqrbase on X to stay updated with BaseQuest Rewards.', 25, 'active', 5, true),
  ('follow-farcaster', 'Follow us on Farcaster', 'Follow @hqc on Farcaster and join the BaseQuest community.', 25, 'active', 6, true),
  ('deploy-contract', 'Deploy Contract', 'Choose a contract template and deploy your first contract on Base.', 50, 'active', 7, true),
  ('claim-nft', 'Claim NFT', 'Mint your BaseQuest Builder Badge NFT after deploying your first contract.', 50, 'active', 8, true),
  ('x402-payment', 'Make an x402 Payment', 'Call the premium x402 endpoint and complete one successful payment on Base Mainnet.', 100, 'active', 9, true)
on conflict (id) do nothing;
```

## Production

Live app: [https://basequest-rewards.vercel.app](https://basequest-rewards.vercel.app)

All on-chain quests (Daily Check-in, Deploy Contract, Claim NFT, x402) run on **Base Mainnet** only.

```bash
npm run build
npm start
```

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import the project in Vercel.
3. Add every variable from `.env.example` in the Vercel project settings (including `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` and `NEXT_PUBLIC_APP_URL=https://basequest-rewards.vercel.app`).
4. Deploy.

## Base Mini App / Farcaster manifest

Production Mini App metadata lives at `public/.well-known/farcaster.json` and points at:

- `homeUrl`: `https://basequest-rewards.vercel.app/`
- `iconUrl`: `https://basequest-rewards.vercel.app/app-icon.png`

Keep `NEXT_PUBLIC_APP_URL` aligned with that domain for X OAuth redirects (`/api/auth/x/callback`).

## Routes

| Route | Description |
|-------|-------------|
| `/` | Dashboard — quests, wallet, progress |
| `/leaderboard` | Top 50 users by XP |
| `/profile` | Connected wallet profile, badges, stats |

## Local storage

Progress is stored per wallet in the browser using keys scoped to the connected wallet address. Guest progress uses a separate key when no wallet is connected. With a connected wallet, Supabase is the source of truth for XP and completed quests.
