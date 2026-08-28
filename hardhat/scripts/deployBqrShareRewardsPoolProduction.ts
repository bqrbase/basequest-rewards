/**
 * Deploy BqrShareRewardsPoolProduction to Base Mainnet.
 *
 * DO NOT run this script until the contract and tests are reviewed.
 * This file is local-only. It does not execute on import.
 *
 * Prerequisites (hardhat/.env):
 *   BASE_RPC_URL=...
 *   DEPLOYER_PRIVATE_KEY=...   (must NOT be owner or operator)
 *
 * Run later, production optimizer profile only:
 *   npx hardhat compile --build-profile production
 *   npx hardhat run scripts/deployBqrShareRewardsPoolProduction.ts --network base --build-profile production
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { network } from "hardhat";
import { getAddress } from "viem";

import {
  assertNotExistingSharePool,
  assertProductionDeployConstructorArgs,
  HARDHAT_DEPLOYER,
  OLD_LIVE_SHARE_POOL,
  PRODUCTION_BQR_TOKEN,
  PRODUCTION_POOL_OPERATOR,
  PRODUCTION_POOL_OWNER,
  TEST_ONLY_SHARE_POOL,
} from "./lib/bqrShareRewardsPoolProductionGuards.js";

const COMPILER_VERSION = "0.8.28";
const OPTIMIZER = { enabled: true, runs: 200 } as const;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const reportDir = path.join(rootDir, "deployments", "base-mainnet");
const reportJsonPath = path.join(
  reportDir,
  "BqrShareRewardsPoolProduction.json",
);
const constructorArgsPath = path.join(
  __dirname,
  "constructorArgs",
  "BqrShareRewardsPoolProduction.ts",
);

if (process.env.ALLOW_PRODUCTION_SHARE_POOL_DEPLOY !== "true") {
  throw new Error(
    "Refusing to deploy BqrShareRewardsPoolProduction. Set ALLOW_PRODUCTION_SHARE_POOL_DEPLOY=true only after review.",
  );
}

const connection = await network.create({
  network: "base",
  chainType: "op",
});

const { viem } = connection;
const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();

const chainId = await publicClient.getChainId();
const deployerAddress = getAddress(deployer.account.address);
const initialOwner = PRODUCTION_POOL_OWNER;
const operator = PRODUCTION_POOL_OPERATOR;
const bqrToken = PRODUCTION_BQR_TOKEN;

if (deployerAddress === initialOwner) {
  throw new Error(
    `Refusing to deploy: DEPLOYER_PRIVATE_KEY (${deployerAddress}) must not be the pool owner.`,
  );
}
if (deployerAddress === operator) {
  throw new Error(
    `Refusing to deploy: DEPLOYER_PRIVATE_KEY (${deployerAddress}) must not be the operator.`,
  );
}
if (deployerAddress !== HARDHAT_DEPLOYER) {
  throw new Error(
    `Refusing to deploy: unexpected deployer ${deployerAddress}, expected ${HARDHAT_DEPLOYER}.`,
  );
}

assertProductionDeployConstructorArgs({
  chainId,
  initialOwner,
  operator,
  bqrToken,
});

console.log("Network: base (mainnet)");
console.log("Chain ID:", chainId);
console.log("Deployer (tx sender):", deployerAddress);
console.log("initialOwner:", initialOwner);
console.log("operator:", operator);
console.log("BQR token:", bqrToken);
console.log("Compiler:", COMPILER_VERSION);
console.log("Optimizer:", OPTIMIZER);
console.log("Untouched TEST pool:", TEST_ONLY_SHARE_POOL);
console.log("Untouched old live pool:", OLD_LIVE_SHARE_POOL);

const deployed = await viem.sendDeploymentTransaction(
  "BqrShareRewardsPoolProduction",
  [initialOwner, operator, bqrToken],
);
const txHash = deployed.deploymentTransaction.hash;
const contractAddress = deployed.contract.address;

assertNotExistingSharePool(contractAddress);

const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
if (receipt.status !== "success") {
  throw new Error("BqrShareRewardsPoolProduction deployment reverted");
}

const pool = deployed.contract;
const onChainOwner = await pool.read.owner();
const onChainOperator = await pool.read.operator();
const onChainToken = await pool.read.bqrToken();
const onChainReward = await pool.read.rewardAmount();

if (getAddress(onChainOwner) !== initialOwner) {
  throw new Error("Post-deploy owner mismatch");
}
if (getAddress(onChainOperator) !== operator) {
  throw new Error("Post-deploy operator mismatch");
}
if (getAddress(onChainToken) !== bqrToken) {
  throw new Error("Post-deploy bqrToken mismatch");
}
if (onChainReward !== 25n * 10n ** 18n) {
  throw new Error("Post-deploy rewardAmount mismatch");
}

await mkdir(reportDir, { recursive: true });
await writeFile(
  constructorArgsPath,
  `/**
 * Constructor args for BqrShareRewardsPoolProduction verification.
 */
const constructorArgs: [\`0x\${string}\`, \`0x\${string}\`, \`0x\${string}\`] = [
  "${initialOwner}",
  "${operator}",
  "${bqrToken}",
];

export default constructorArgs;
`,
  "utf8",
);

const report = {
  network: "base",
  chainId,
  contract: "BqrShareRewardsPoolProduction",
  contractAddress,
  transactionHash: txHash,
  blockNumber: receipt.blockNumber.toString(),
  deployer: deployerAddress,
  constructorArguments: {
    initialOwner,
    operator,
    bqrToken,
  },
  onChain: {
    owner: getAddress(onChainOwner),
    operator: getAddress(onChainOperator),
    bqrToken: getAddress(onChainToken),
    rewardAmount: onChainReward.toString(),
  },
  untouched: {
    testOnlyPool: TEST_ONLY_SHARE_POOL,
    oldLivePool: OLD_LIVE_SHARE_POOL,
  },
};

await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log("BqrShareRewardsPoolProduction deployed to:", contractAddress);
