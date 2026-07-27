/**
 * Deploy RewardsDistributor to Base Mainnet and write a deployment report.
 *
 * Prerequisites (hardhat/.env):
 *   BASE_RPC_URL=...
 *   DEPLOYER_PRIVATE_KEY=...
 *   BASESCAN_API_KEY=...   (for verify via Etherscan API v2)
 *
 * Run (production optimizer profile):
 *   npx hardhat compile --build-profile production
 *   npx hardhat run scripts/deployRewardsDistributor.ts --network base --build-profile production
 *
 * Then verify:
 *   npx hardhat verify --network base --build-profile production \
 *     --contract contracts/RewardsDistributor.sol:RewardsDistributor \
 *     --constructor-args-path scripts/constructorArgs/RewardsDistributor.ts \
 *     <DEPLOYED_ADDRESS>
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { network } from "hardhat";
import { getAddress, isAddress } from "viem";

const BQR_TOKEN = getAddress("0xB200000000000000000000Bf7E6dcf0cF466939a");
const COMPILER_VERSION = "0.8.28";
const OPTIMIZER = { enabled: true, runs: 200 } as const;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const reportDir = path.join(rootDir, "deployments", "base-mainnet");
const reportJsonPath = path.join(reportDir, "RewardsDistributor.json");
const reportMdPath = path.join(reportDir, "RewardsDistributor.REPORT.md");
const constructorArgsPath = path.join(
  __dirname,
  "constructorArgs",
  "RewardsDistributor.ts",
);

const connection = await network.create({
  network: "base",
  chainType: "op",
});

const { viem } = connection;
const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();

const chainId = await publicClient.getChainId();
if (chainId !== 8453) {
  throw new Error(`Expected Base Mainnet (8453), got chainId ${chainId}`);
}

const initialOwner = getAddress(deployer.account.address);
if (!isAddress(BQR_TOKEN)) {
  throw new Error("Invalid BQR token address");
}

console.log("Network: base (mainnet)");
console.log("Chain ID:", chainId);
console.log("Deployer / initialOwner:", initialOwner);
console.log("BQR token:", BQR_TOKEN);
console.log("Compiler:", COMPILER_VERSION);
console.log("Optimizer:", OPTIMIZER);

// Public Base RPC can lag after broadcast; recover receipt by hash if needed.
let txHash: `0x${string}`;
let knownAddress: `0x${string}` | undefined;

try {
  const deployed = await viem.sendDeploymentTransaction("RewardsDistributor", [
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
const blockNumber = Number(receipt.blockNumber);

const distributor = await viem.getContractAt(
  "RewardsDistributor",
  contractAddress,
);
const onChainOwner = await distributor.read.owner();
const onChainToken = await distributor.read.bqrToken();

if (getAddress(onChainOwner) !== initialOwner) {
  throw new Error("Post-deploy owner mismatch");
}
if (getAddress(onChainToken) !== BQR_TOKEN) {
  throw new Error("Post-deploy bqrToken mismatch");
}

const report = {
  network: "base",
  chainId,
  contract: "RewardsDistributor",
  contractAddress,
  transactionHash: txHash,
  blockNumber,
  deployer: initialOwner,
  status: receipt.status,
  constructorArguments: {
    initialOwner,
    bqrToken: BQR_TOKEN,
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
 * Constructor args for RewardsDistributor verification.
 * Auto-written by deployRewardsDistributor.ts
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

const md = `# RewardsDistributor — Base Mainnet Deployment Report

| Field | Value |
|-------|-------|
| Contract address | \`${contractAddress}\` |
| Transaction hash | \`${txHash}\` |
| Block number | \`${blockNumber}\` |
| Network | Base Mainnet (\`${chainId}\`) |
| Deployer / initialOwner | \`${initialOwner}\` |
| BQR token | \`${BQR_TOKEN}\` |
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
  --contract contracts/RewardsDistributor.sol:RewardsDistributor \\
  --constructor-args-path scripts/constructorArgs/RewardsDistributor.ts \\
  ${contractAddress}
\`\`\`
`;

await writeFile(reportMdPath, md, "utf8");

console.log("RewardsDistributor deployed to:", contractAddress);
console.log("Block number:", blockNumber);
console.log("Report JSON:", reportJsonPath);
console.log("Report MD:", reportMdPath);
console.log(JSON.stringify(report, null, 2));
