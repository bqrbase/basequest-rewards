# Sample Hardhat 3 Project (`node:test` and `viem`)

This project showcases a Hardhat 3 project using the native Node.js test runner (`node:test`) and the `viem` library for Ethereum interactions.

To learn more about Hardhat 3, please visit the [Getting Started guide](https://hardhat.org/docs/getting-started#getting-started-with-hardhat-3). To share your feedback, join our [Hardhat 3](https://hardhat.org/hardhat3-telegram-group) Telegram group or [open an issue](https://github.com/NomicFoundation/hardhat/issues/new) in our GitHub issue tracker.

## Project Overview

This example project includes:

- A simple Hardhat configuration file.
- Foundry-compatible Solidity unit tests.
- TypeScript integration tests using [`node:test`](nodejs.org/api/test.html), the new Node.js native test runner, and [`viem`](https://viem.sh/).
- Examples demonstrating how to connect to different types of networks, including locally simulating OP mainnet.

## Usage

### Running Tests

To run all the tests in the project, execute the following command:

```shell
npx hardhat test
```

You can also selectively run the Solidity or `node:test` tests:

```shell
npx hardhat test solidity
npx hardhat test nodejs
```

### Deploy to Base Mainnet

Production deploys use **Base Mainnet only** (`chainId` 8453).

Set in `hardhat/.env`:

```shell
BASE_RPC_URL=https://mainnet.base.org
DEPLOYER_PRIVATE_KEY=...
```

Deploy scripts:

```shell
npx hardhat run scripts/deployDailyCheckIn.ts --network base
npx hardhat run scripts/deployBaseQuestBadge.ts --network base
npx hardhat run scripts/deployHelloBase.ts --network base
```

Historical Base Sepolia Ignition artifacts under `ignition/deployments/chain-84532/` are **development only** — see `DEVELOPMENT_ONLY.md` in that folder.
