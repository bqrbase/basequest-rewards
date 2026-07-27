# Rewards System E2E Readiness Report

Generated: 2026-07-27T00:35:00.000Z

## Verdict

**Publish path ready; claim still blocked on funding.**  
After applying `20260728_align_reward_merkle_snapshot_schema.sql`, post-migration E2E confirmed:

`snapshot (status=snapshotted)` → `build (ready)` → `createCampaign` → `link (published)` → `pending` → `claim-proof` — **8/8 PASS**.

Successful on-chain claim remains blocked: deployer has **0 BQR**; supply is in `0xD34f706D5a5567FC0d45eFFa1623a37B66Ea41a2`.

## Environment

| Item | Value |
|------|-------|
| Distributor | `0x8DB0F6a276242787f8DA48360898cC3B5FC0bCe9` |
| BQR (B20 Asset) | `0xB200000000000000000000Bf7E6dcf0cF466939a` |
| Owner / deployer | `0x1819171c76D4B993ae6f14f43381b1Dfcd2AA09f` |
| BQR supply holder | `0xD34f706D5a5567FC0d45eFFa1623a37B66Ea41a2` (1e9 BQR) |
| On-chain campaigns created | `1`, `2`, `3` (same Merkle root) |
| Latest linked published campaign | off-chain `abac780e-3b57-48e8-b7fe-08f7483e91cb` → on-chain id `3` |
| Merkle root | `0x36501df999bf2aaaf0134fef2f5592ae28e1eab656c95051d0d9986a5a7beee1` |
| Leaves | 42 (~465 BQR total) |
| Schema migration | `20260728_align_reward_merkle_snapshot_schema.sql` applied; snapshot status is `snapshotted` |

## Flow checklist

| Step | Result | Evidence |
|------|--------|----------|
| 1. Create reward campaign | PASS | Admin API draft create |
| 2. Build Merkle tree | PASS | 42 leaves, root above |
| 3. Fund RewardsDistributor | **BLOCKED** | Owner BQR = 0; dist balance = 0 |
| 4. Link campaign | PASS | Status `published`, on-chain id `2` |
| 5. Connect test wallet | PASS | Owner row in `users`; pending API |
| 6. Pending rewards appear | PASS | `claimableCount=8` for owner |
| 7. Successfully claim BQR | **BLOCKED** | Valid proof simulates; reverts `InsufficientBalance` (B20) with empty vault |
| 8a. RewardClaimed event | NOT RUN | Needs successful claim |
| 8b. BQR balance increased | NOT RUN | Needs successful claim |
| 8c. Pending clears | NOT RUN | Needs successful claim |
| 8d. Duplicate claim rejected | NOT RUN | Needs successful claim first |
| 9a. Invalid proof | PASS | `InvalidProof` |
| 9b. Wrong wallet | PASS | `InvalidProof` |
| 9c. Paused contract | PASS | Pause → claim rejected → unpause restored |
| 9d. Insufficient distributor balance | PASS | Valid proof + empty vault → B20 `InsufficientBalance` (`0xdb42144d`) |

## Bugs found and fixed during validation

1. **Snapshot insert failed (`leaf_hash` / `leaf_index` NOT NULL)**  
   Live DB still enforces NOT NULL; migration `20260727_reward_campaign_snapshot_status.sql` not applied.  
   **Fix:** compute leaf hashes + provisional indices at snapshot (safe now that leaf has no `campaignId`).

2. **Status `snapshotted` rejected by check constraint**  
   Live `reward_campaigns_status_check` does not allow `snapshotted`.  
   **Fix:** fall back to `draft` after snapshot when that constraint fires; allow build from `draft` when allocations exist.

3. **Failed snapshots burned eligibility forever**  
   Orphan allocation rows in draft campaigns were counted as “already allocated.”  
   **Fix:** prior-allocation summary only counts committed campaigns; orphan draft allocations cleaned on next snapshot.

4. **Link failed: distributor address “not configured”**  
   Env used a mixed-case address that fails viem `isAddress` strict EIP-55 checksum.  
   **Fix:** `isAddress(raw, { strict: false })`, checksummed constant fallback, corrected `.env.local` value.

## Remaining issues (blocking)

1. **Fund BQR into the distributor**  
   Transfer ≥ claim amount (recommend ≥ 50 BQR for e2e) from  
   `0xD34f706D5a5567FC0d45eFFa1623a37B66Ea41a2` → owner `0x1819171c76D4B993ae6f14f43381b1Dfcd2AA09f`,  
   then `approve` + `fund` on the distributor.  
   Or set `BQR_FUNDER_PRIVATE_KEY` for the holder and re-run  
   `npx hardhat run scripts/e2eValidateRewards.ts --network base --build-profile production`.

2. **Apply Supabase migration `20260727_reward_campaign_snapshot_status.sql`**  
   Adds `snapshotted` status and nullable leaf columns. Code works around this, but schema should match migrations.

3. **Finish claim verification after funding**  
   Re-run E2E (or manual claim on `/rewards`) to confirm:  
   `RewardClaimed` event, balance delta, pending clear, duplicate reject.

## Notes

- Leaf formula: `keccak256(account, rewardId, amount)` (no `campaignId`).
- Publish flow: snapshot → build → external `createCampaign(root)` → fund → link.
- Pause test temporarily paused mainnet distributor and unpaused afterward; currently unpaused.
- Campaigns `1` and `2` share the same root; published link points at `2`.
- Hardhat unit tests previously covered claim success / duplicate / insufficient balance with a mock ERC-20 (25 passing).
