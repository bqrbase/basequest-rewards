# BqrShareRewardsPool — Base Mainnet Deployment Report

| Field | Value |
|-------|-------|
| Contract address | `0x967EdCDcf74d6793F1c6d09a1056ec66481513cB` |
| Transaction hash | `0xa2f545b18e54f0d8c934aa4ad222bd42d0e1660cd3af79508d05d34c49844731` |
| Block number | `50527606` |
| Network | Base Mainnet (`8453`) |
| Deployer (tx sender) | `0x1819171c76D4B993ae6f14f43381b1Dfcd2AA09f` |
| initialOwner / `owner()` | `0xD34f706D5a5567FC0d45eFFa1623a37B66Ea41a2` |
| BQR token / `bqrToken()` | `0xB200000000000000000000Bf7E6dcf0cF466939a` |
| `tokenBalance()` | `0` |
| `totalPaid()` | `0` |
| `rewardAmount` | `25e18` |
| Bytecode | present (`3952` bytes) |
| Compiler version | `0.8.28` |
| Optimizer | enabled=`true`, runs=`200` |
| Build profile | `production` |
| EVM target | `cancun` |
| Basescan (verified) | https://basescan.org/address/0x967EdCDcf74d6793F1c6d09a1056ec66481513cB#code |
| Transaction | https://basescan.org/tx/0xa2f545b18e54f0d8c934aa4ad222bd42d0e1660cd3af79508d05d34c49844731 |
| Deployed at (UTC) | 2026-08-27T15:29:21.968Z |

## Constructor arguments

1. `initialOwner` (address): `0xD34f706D5a5567FC0d45eFFa1623a37B66Ea41a2`
2. `bqrToken_` (address): `0xB200000000000000000000Bf7E6dcf0cF466939a`

## Post-deploy checks

- `owner()` → `0xD34f706D5a5567FC0d45eFFa1623a37B66Ea41a2`
- `bqrToken()` → `0xB200000000000000000000Bf7E6dcf0cF466939a`
- `tokenBalance()` → `0`
- `totalPaid()` → `0`
- bytecode exists at the deployed address
- address is not RewardsDistributor (`0x8DB0F6a276242787f8DA48360898cC3B5FC0bCe9`)

## Verification status

- Basescan: **verified** (Exact Match)
- Blockscout: **verified**
- Hardhat CLI: submitted source, then `HHE80001` empty status poll; explorers confirmed verification
