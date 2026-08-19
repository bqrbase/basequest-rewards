# Wallet authentication removal

Permanent architecture: connect never signs. XP is awarded only after
server-side Base transaction verification (Genesis uses on-chain holder
balance because mint is owner-executed).

## Files removed

- `lib/wallet/Authentication.ts`
- `lib/wallet/Signer.ts`
- `components/wallet/WalletAuthLifecycle.tsx`
- `lib/quests/enforceWalletOwnership.ts`
- `lib/swap/verifyBaseSwapTx.ts` (replaced by `verifyBaseTransaction`)

Previously already gone from the tree (confirmed unused):

- `lib/wallet/auth/*` (`ensureSessionClient`, cookies, HMAC)
- `hooks/useWalletAuth.ts`
- `app/api/auth/wallet/*`

## Files changed

- `lib/wallet/Errors.ts` — dropped `AUTHENTICATION_FAILED`
- `lib/wallet/ARCHITECTURE.md` — no auth; tx-proof table
- `components/ConnectWalletButton.tsx` — connect-only comment
- `app/privacy/page.tsx` — cookies no longer describe wallet ownership sessions
- `.env.example` — removed `WALLET_AUTH_SECRET`
- `lib/supabase/users.ts` — comments
- `lib/chain/questContracts.ts` — **added** selectors / addresses
- Quest complete / save routes now call `verifyBaseTransactionWithRetry`:
  - `app/api/quests/daily-check-in/complete/route.ts`
  - `app/api/quests/claim-nft/complete/route.ts`
  - `app/api/quests/first-swap/complete/route.ts`
  - `app/api/quests/x402-payment/complete/route.ts`
  - `app/api/quests/bridge-to-base/complete/route.ts`
  - `app/api/quests/deploy-contract/complete/route.ts` (already creation-aware)
  - `app/api/nfts/claim/save/route.ts`
  - `app/api/contracts/save/route.ts`
  - `app/api/x402/payments/save/route.ts`
  - `app/api/quests/mint-genesis/complete/route.ts` (holder proof documented)

## Auth code removed

- Wallet ownership `personal_sign` / SIWE
- Auth cookies / HMAC session
- `requireAuth` on TransactionManager
- Client `ensureWalletAuth` before writes
- `AUTHENTICATION_FAILED` user-facing copy

## Remaining session dependencies (not wallet ownership)

- **X OAuth** httpOnly cookies in `lib/x/session.ts` (`/api/auth/x/*`) — social follow quest only
- wagmi `cookieStorage` for connector reconnect (not an auth signature)
- `credentials: "include"` on fetch — still used so X cookies work; quest complete bodies do not use wallet auth cookies

## Proof model

| Flow | Server proof |
|------|----------------|
| Daily Check-in | tx exists, sender, DailyCheckIn, `checkIn()`, success |
| Deploy Contract | tx exists, sender, contract creation, success |
| Badge Claim | tx exists, sender, Badge, `claim()`, success |
| Swap / x402 | tx exists, sender, success (router/paymaster `to` varies) |
| Bridge | source sender + Base destination receipt success |
| Genesis XP | `balanceOf` holder check (mint is owner-executed) |
| Rewards Claim | on-chain `isClaimed` after `claim()` (BQR, not XP) |
