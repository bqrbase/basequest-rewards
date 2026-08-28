# BqrShareRewardsPool — TEST-ONLY Base Mainnet Deployment Report

Do not confuse this with the live pool `0x967EdCDcf74d6793F1c6d09a1056ec66481513cB`.
This deployment was not funded. The live pool was not modified.

| Field | Value |
|-------|-------|
| Contract address | `0x75b99B36DDc4206A3c3A5d89436606e637003151` |
| Transaction hash | `0x62cb8bd92d9da9ae93126e30bc3e4ba3f7f312bcef4032716e04ac1e16b23f58` |
| Block number | `50534687` |
| Network | Base Mainnet (`8453`) |
| Deployer (tx sender) | `0x1819171c76D4B993ae6f14f43381b1Dfcd2AA09f` |
| initialOwner / `owner()` | `0xD34f706D5a5567FC0d45eFFa1623a37B66Ea41a2` |
| BQR token / `bqrToken()` | `0xB200000000000000000000Bf7E6dcf0cF466939a` |
| `tokenBalance()` | `0` |
| `totalPaid()` | `0` |
| rewardAmount | `25e18` |
| Bytecode | present (`3510` bytes) |
| Compiler version | `0.8.28` |
| Optimizer | enabled=`true`, runs=`200` |
| Build profile | `production` |
| EVM target | `cancun` |
| Basescan | https://basescan.org/address/0x75b99B36DDc4206A3c3A5d89436606e637003151 |
| Deployed at (UTC) | 2026-08-27T19:25:24.352Z |

## Constructor arguments

1. `initialOwner` (address): `0xD34f706D5a5567FC0d45eFFa1623a37B66Ea41a2`
2. `bqrToken_` (address): `0xB200000000000000000000Bf7E6dcf0cF466939a`

## Verification

```bash
npx hardhat verify --network base --build-profile production \
  --contract contracts/BqrShareRewardsPool.sol:BqrShareRewardsPool \
  --constructor-args-path scripts/constructorArgs/BqrShareRewardsPool.ts \
  0x75b99B36DDc4206A3c3A5d89436606e637003151
```
