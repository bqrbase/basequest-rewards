# BaseQuest Wallet Architecture

## Goals

One production wallet layer for Browser, Base App, and Farcaster Mini App.
Components and domain modules never talk to wagmi/providers directly for
connect, auth, chain, or write operations.

## Non-goals

UI, styling, quest/XP/rewards/referral business logic, Supabase schema,
and smart contracts stay unchanged. Existing hook and API route contracts
remain stable as façades.

## Phased migration (main)

Ship and verify on main one slice at a time. Each phase is an independently
deployable, reversible commit.

| Phase | Scope | Status |
|-------|--------|--------|
| 0 | Add `lib/wallet/*` engine (unused by call sites) | active |
| 1 | Connect Wallet + Authentication only | next |
| 2 | Daily Check-in (`executeCalls`) | pending |
| 3 | Deploy Contract | pending |
| 4 | Remaining writes (badge, rewards, genesis, swap, bridge, x402) | pending |

Do not migrate later phases until the previous phase is verified in Browser,
Base App, and Farcaster.

## Layout

```
lib/wallet/
  ARCHITECTURE.md
  index.ts
  types.ts / constants.ts / Errors.ts / logger.ts
  ConnectorResolver.ts / ProviderResolver.ts / ChainManager.ts
  Signer.ts / Authentication.ts / WalletClient.ts
  TransactionManager.ts / WalletManager.ts / WalletHostContext.tsx
  resolveHostFromConfig.ts
  auth/                    ← server cookie/HMAC (unchanged HTTP contract)
  ensureBaseMainnet.ts     ← existing call-site API (façade in later phases)
  getPreferredConnector.ts ← existing call-site API (façade in phase 1)
```

## Host rules (target)

| Host | Registered connectors | Preferred |
|------|----------------------|-----------|
| Browser | injected, coinbaseWallet, walletConnect | last-used → injected → Coinbase → WC |
| Base App | **baseAccount only** (when verified with connect) | baseAccount |
| Farcaster | **farcasterMiniApp only** (already on main) | farcaster |

## Auth

Connect remains signature-free. Privileged writes call
`Authentication.requireAuthSession` once those flows migrate (phase 2+).
Session cookies and `/api/auth/wallet/*` stay unchanged.

## Transaction pipeline (used from phase 2+)

1. Require connected address
2. Ensure auth session (when required)
3. Ensure required chain
4. Resolve provider + capabilities
5. Prefer `wallet_sendCalls` → else `eth_sendTransaction` / `writeContract`
6. Wait for receipt
7. Return `WalletTxResult` or typed `WalletError`

## Façades (must keep working)

- `useWalletAuth` / `ensureWalletAuthSession`
- `useEnsureBaseMainnet` / `ensureBaseMainnet`
- `useWalletDisconnect`
- `getPreferredConnector`
- `/api/auth/wallet/*`
