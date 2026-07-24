/**
 * Deploy BaseQuestBadge to Base Mainnet.
 *
 * Prerequisites (in hardhat/.env):
 *   BASE_RPC_URL=https://mainnet.base.org
 *   DEPLOYER_PRIVATE_KEY=...
 *
 * Run:
 *   npx hardhat run scripts/deployBaseQuestBadge.ts --network base
 */
import { network } from "hardhat";

const connection = await network.create({
  network: "base",
  chainType: "op",
});

const { viem } = connection;
const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();

console.log("Network: base (mainnet)");
console.log("Chain ID:", await publicClient.getChainId());
console.log("Deployer:", deployer.account.address);

const { contract: badge, deploymentTransaction } =
  await viem.sendDeploymentTransaction("BaseQuestBadge");

const txHash = deploymentTransaction.hash;
console.log("Deployment tx:", txHash);

// Public Base RPC can lag behind tx broadcast; poll until the receipt is available.
let receipt = await publicClient
  .waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
    timeout: 180_000,
  })
  .catch(async () => {
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        return await publicClient.getTransactionReceipt({ hash: txHash });
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 3_000));
      }
    }
    throw new Error(`Timed out waiting for deployment receipt: ${txHash}`);
  });

const contractAddress = receipt.contractAddress ?? badge.address;

console.log("BaseQuestBadge deployed to:", contractAddress);
console.log("name:", await badge.read.name());
console.log("symbol:", await badge.read.symbol());
console.log(
  "Set NEXT_PUBLIC_BASEQUEST_BADGE_ADDRESS=" +
    contractAddress +
    " in the Next.js env.",
);

console.log(
  JSON.stringify(
    {
      network: "base",
      chainId: await publicClient.getChainId(),
      contractAddress,
      transactionHash: txHash,
      status: receipt.status,
    },
    null,
    2,
  ),
);
