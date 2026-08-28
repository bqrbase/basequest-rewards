/**
 * Deploy BqrShareRewardsPool to Base Mainnet and write a deployment report.
 *
 * DO NOT run this script in Phase 1. Local implementation / testing only.
 *
 * Prerequisites (hardhat/.env):
 *   BASE_RPC_URL=...
 *   DEPLOYER_PRIVATE_KEY=...
 *   BASESCAN_API_KEY=...       (for verify via Etherscan API v2)
 *
 * Run (production optimizer profile) — later phase only:
 *   npx hardhat compile --build-profile production
 *   npx hardhat run scripts/deployBqrShareRewardsPool.ts --network base --build-profile production
 *
 * Then verify:
 *   npx hardhat verify --network base --build-profile production \
 *     --contract contracts/BqrShareRewardsPool.sol:BqrShareRewardsPool \
 *     --constructor-args-path scripts/constructorArgs/BqrShareRewardsPool.ts \
 *     <DEPLOYED_ADDRESS>
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { network } from "hardhat";
import { getAddress } from "viem";

import {
  assertDeployConstructorArgs,
  BQR_TOKEN,
  POOL_INITIAL_OWNER,
} from "./lib/bqrShareRewardsPoolGuards.js";

const COMPILER_VERSION = "0.8.28";
const OPTIMIZER = { enabled: true, runs: 200 } as const;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const LIVE_POOL = getAddress("0x967EdCDcf74d6793F1c6d09a1056ec66481513cB");
const reportDir = path.join(rootDir, "deployments", "base-mainnet");
const reportJsonPath = path.join(
  reportDir,
  "BqrShareRewardsPool.test-only.json",
);
const reportMdPath = path.join(
  reportDir,
  "BqrShareRewardsPool.test-only.REPORT.md",
);
const constructorArgsPath = path.join(
  __dirname,
  "constructorArgs",
  "BqrShareRewardsPool.ts",
);

const connection = await network.create({
  network: "base",
  chainType: "op",
});

const { viem } = connection;
const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();

const chainId = await publicClient.getChainId();
const deployerAddress = getAddress(deployer.account.address);
const initialOwner = POOL_INITIAL_OWNER;

if (initialOwner === deployerAddress) {
  throw new Error(
    `Refusing to deploy: DEPLOYER_PRIVATE_KEY (${deployerAddress}) must not be the pool owner. Owner is ${POOL_INITIAL_OWNER}.`,
  );
}

assertDeployConstructorArgs({
  chainId,
  initialOwner,
  bqrToken: BQR_TOKEN,
});

console.log("Network: base (mainnet)");
console.log("Chain ID:", chainId);
console.log("Deployer (tx sender):", deployerAddress);
console.log("initialOwner:", initialOwner);
console.log("BQR token:", BQR_TOKEN);
console.log("Compiler:", COMPILER_VERSION);
console.log("Optimizer:", OPTIMIZER);

let txHash: `0x${string}`;
let knownAddress: `0x${string}` | undefined;

try {
  const deployed = await viem.sendDeploymentTransaction("BqrShareRewardsPool", [
    initialOwner,
    BQR_TOKEN,
  ]);
  txHash = deployed.deploymentTransaction.hash;
  knownAddress = deployed.contract.address;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const match = /0x[a-fA-F0-9]{64}/.exec(message);
  if (!match) {
    throw error;
  }
  txHash = match[0] as `0x${string}`;
  console.warn(
    "Deployment broadcast succeeded but RPC lagged; recovering receipt for",
    txHash,
  );
}

console.log("Deployment tx:", txHash);

async function waitForReceipt(hash: `0x${string}`) {
  try {
    return await publicClient.waitForTransactionReceipt({
      hash,
      confirmations: 2,
      timeout: 300_000,
    });
  } catch {
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        return await publicClient.getTransactionReceipt({ hash });
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 3_000));
      }
    }
    throw new Error(`Timed out waiting for deployment receipt: ${hash}`);
  }
}

const receipt = await waitForReceipt(txHash);
if (receipt.status !== "success") {
  throw new Error(`Deployment transaction failed: ${txHash}`);
}

if (!receipt.contractAddress && !knownAddress) {
  throw new Error("Deployment receipt missing contractAddress");
}

const contractAddress = getAddress(
  (receipt.contractAddress ?? knownAddress) as `0x${string}`,
);
if (contractAddress === LIVE_POOL) {
  throw new Error(
    "Refusing to treat the live Share Rewards pool as this TEST-ONLY deploy.",
  );
}
const blockNumber = Number(receipt.blockNumber);

const pool = await viem.getContractAt("BqrShareRewardsPool", contractAddress);
const onChainOwner = await pool.read.owner();
const onChainToken = await pool.read.bqrToken();
const onChainReward = await pool.read.rewardAmount();
const onChainBalance = await pool.read.tokenBalance();
const onChainTotalPaid = await pool.read.totalPaid();
const bytecode = await publicClient.getCode({ address: contractAddress });
const bytecodeBytes =
  bytecode && bytecode !== "0x" ? (bytecode.length - 2) / 2 : 0;

if (getAddress(onChainOwner) !== initialOwner) {
  throw new Error("Post-deploy owner mismatch");
}
if (getAddress(onChainToken) !== BQR_TOKEN) {
  throw new Error("Post-deploy bqrToken mismatch");
}
if (onChainReward !== 25n * 10n ** 18n) {
  throw new Error("Post-deploy rewardAmount mismatch");
}

const report = {
  network: "base",
  chainId,
  contract: "BqrShareRewardsPool",
  testOnly: true,
  livePoolUntouched: LIVE_POOL,
  contractAddress,
  transactionHash: txHash,
  blockNumber,
  deployer: deployerAddress,
  status: receipt.status,
  constructorArguments: {
    initialOwner,
    bqrToken: BQR_TOKEN,
  },
  onChain: {
    owner: getAddress(onChainOwner),
    bqrToken: getAddress(onChainToken),
    tokenBalance: onChainBalance.toString(),
    totalPaid: onChainTotalPaid.toString(),
    rewardAmount: onChainReward.toString(),
    bytecodeBytes,
  },
  compiler: {
    version: COMPILER_VERSION,
    optimizer: OPTIMIZER,
    buildProfile: "production",
    evmVersion: "cancun",
  },
  explorers: {
    address: `https://basescan.org/address/${contractAddress}`,
    tx: `https://basescan.org/tx/${txHash}`,
  },
  verifiedOnBasescan: false,
  deployedAt: new Date().toISOString(),
};

await mkdir(reportDir, { recursive: true });

await writeFile(
  constructorArgsPath,
  `/**
 * Constructor args for BqrShareRewardsPool verification.
 * Auto-written by deployBqrShareRewardsPool.ts
 */
const constructorArgs: [\`0x\${string}\`, \`0x\${string}\`] = [
  "${initialOwner}",
  "${BQR_TOKEN}",
];

export default constructorArgs;
`,
  "utf8",
);

await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

const md = `# BqrShareRewardsPool — TEST-ONLY Base Mainnet Deployment Report

Do not confuse this with the live pool \`${LIVE_POOL}\`.
This deployment was not funded. The live pool was not modified.

| Field | Value |
|-------|-------|
| Contract address | \`${contractAddress}\` |
| Transaction hash | \`${txHash}\` |
| Block number | \`${blockNumber}\` |
| Network | Base Mainnet (\`${chainId}\`) |
| Deployer (tx sender) | \`${deployerAddress}\` |
| initialOwner / \`owner()\` | \`${initialOwner}\` |
| BQR token / \`bqrToken()\` | \`${BQR_TOKEN}\` |
| \`tokenBalance()\` | \`${onChainBalance.toString()}\` |
| \`totalPaid()\` | \`${onChainTotalPaid.toString()}\` |
| rewardAmount | \`25e18\` |
| Bytecode | present (\`${bytecodeBytes}\` bytes) |
| Compiler version | \`${COMPILER_VERSION}\` |
| Optimizer | enabled=\`${OPTIMIZER.enabled}\`, runs=\`${OPTIMIZER.runs}\` |
| Build profile | \`production\` |
| EVM target | \`cancun\` |
| Basescan | ${report.explorers.address} |
| Deployed at (UTC) | ${report.deployedAt} |

## Constructor arguments

1. \`initialOwner\` (address): \`${initialOwner}\`
2. \`bqrToken_\` (address): \`${BQR_TOKEN}\`

## Verification

\`\`\`bash
npx hardhat verify --network base --build-profile production \\
  --contract contracts/BqrShareRewardsPool.sol:BqrShareRewardsPool \\
  --constructor-args-path scripts/constructorArgs/BqrShareRewardsPool.ts \\
  ${contractAddress}
\`\`\`
`;

await writeFile(reportMdPath, md, "utf8");

console.log("BqrShareRewardsPool deployed to:", contractAddress);
console.log("Block number:", blockNumber);
console.log("Report JSON:", reportJsonPath);
console.log("Report MD:", reportMdPath);
console.log(JSON.stringify(report, null, 2));
