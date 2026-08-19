# BaseQuest Wallet Architecture

## Goals

One production wallet layer for Browser, Base App, and Farcaster Mini App.
Connecting a wallet never requests a signature. XP and quest completion are
awarded only after the server verifies an on-chain transaction (or, for Genesis,
an on-chain holder balance).

## Auth (removed)

Wallet ownership signatures, SIWE / `personal_sign` sessions, authentication
cookies, `Authentication.ts`, `Signer.ts`, `WalletAuthLifecycle`,
`ensureSessionClient`, and `/api/auth/wallet/*` are gone.

Connect Wallet only connects.

## Quest / XP proof

After a successful write, the client sends `{ wallet, txHash }` to a dedicated
complete endpoint. The server verifies via `lib/chain/verifyBaseTransaction.ts`:

1. Transaction exists on Base
2. Sender matches the connected wallet
3. Expected contract (when applicable)
4. Expected function selector (when applicable)
5. Receipt status is success

Only then does the service-role path update Supabase and award XP.

| Flow | Proof |
|------|--------|
| Daily Check-in | `checkIn()` on DailyCheckIn |
| Deploy Contract | contract-creation tx from wallet |
| Badge Claim | `claim()` on BaseQuestBadge |
| First Swap / x402 | sender + success on Base |
| Bridge | source tx from wallet + Base destination receipt |
| Genesis XP | on-chain `balanceOf` (mint is owner-executed) |
| Rewards Claim | on-chain `isClaimed` after `claim()` (no XP) |

## Layout

```
lib/wallet/
  ARCHITECTURE.md
  index.ts
  types.ts / constants.ts / Errors.ts / logger.ts
  ConnectorResolver.ts / ProviderResolver.ts / ChainManager.ts
  WalletClient.ts / TransactionManager.ts / WalletManager.ts
  WalletHostContext.tsx / resolveHostFromConfig.ts
  ensureBaseMainnet.ts / getPreferredConnector.ts

lib/chain/
  verifyBaseTransaction.ts
  questContracts.ts
```

## Transaction pipeline

1. Require connected address
2. Ensure required chain
3. Resolve provider + capabilities
4. Prefer `wallet_sendCalls` → else `eth_sendTransaction` / `writeContract`
5. Wait for receipt
6. Client posts txHash; server verifies; XP awarded
