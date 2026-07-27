/**
 * Fund the deployed RewardsDistributor with BQR (owner signer).
 *
 * Prerequisites (hardhat/.env):
 *   BASE_RPC_URL=...
 *   DEPLOYER_PRIVATE_KEY=...   (must be RewardsDistributor owner)
 *
 * Run:
 *   npx hardhat run scripts/fundRewardsDistributor.ts --network base --build-profile production
 */
import "dotenv/config";

import { network } from "hardhat";
import {
  erc20Abi,
  formatUnits,
  getAddress,
  parseEther,
  type Hex,
} from "viem";
import { base } from "viem/chains";

const BQR_TOKEN = getAddress("0xB200000000000000000000Bf7E6dcf0cF466939a");
const DISTRIBUTOR = getAddress("0x8db0F6A276242787F8DA48360898Cc3B5FC0Bce9");
const FUND_AMOUNT = parseEther("10000"); // 10000 BQR, 18 decimals

const connection = await network.create({
  network: "base",
  chainType: "op",
});

const { viem } = connection;
const publicClient = await viem.getPublicClient();
const [owner] = await viem.getWalletClients();
const ownerAddress = getAddress(owner.account.address);

const distributor = await viem.getContractAt("RewardsDistributor", DISTRIBUTOR);

const chainId = await publicClient.getChainId();
if (chainId !== 8453) {
  throw new Error(`Expected Base Mainnet (8453), got chainId=${chainId}`);
}

const onChainOwner = getAddress(await distributor.read.owner());
if (onChainOwner !== ownerAddress) {
  throw new Error(
    `Signer ${ownerAddress} is not distributor owner ${onChainOwner}`,
  );
}

const onChainToken = getAddress(await distributor.read.bqrToken());
if (onChainToken !== BQR_TOKEN) {
  throw new Error(
    `Distributor bqrToken mismatch: on-chain=${onChainToken} expected=${BQR_TOKEN}`,
  );
}

const ownerBal = (await publicClient.readContract({
  address: BQR_TOKEN,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [ownerAddress],
})) as bigint;

if (ownerBal < FUND_AMOUNT) {
  throw new Error(
    `Owner BQR balance insufficient: have ${formatUnits(ownerBal, 18)}, need ${formatUnits(FUND_AMOUNT, 18)}`,
  );
}

const allowance = (await publicClient.readContract({
  address: BQR_TOKEN,
  abi: erc20Abi,
  functionName: "allowance",
  args: [ownerAddress, DISTRIBUTOR],
})) as bigint;

let approveTx: Hex | null = null;
if (allowance < FUND_AMOUNT) {
  approveTx = await owner.writeContract({
    address: BQR_TOKEN,
    abi: erc20Abi,
    functionName: "approve",
    args: [DISTRIBUTOR, FUND_AMOUNT],
    chain: base,
    account: owner.account,
  });
  console.log("approve tx:", approveTx);
  const approveReceipt = await publicClient.waitForTransactionReceipt({
    hash: approveTx,
    confirmations: 1,
    timeout: 300_000,
  });
  if (approveReceipt.status !== "success") {
    throw new Error(`Approve failed: ${approveTx}`);
  }
} else {
  console.log(
    "approve tx: (skipped — allowance already >= 10000 BQR)",
    `allowance=${formatUnits(allowance, 18)}`,
  );
}

const fundTx = await distributor.write.fund([FUND_AMOUNT], {
  account: owner.account,
});
console.log("fund tx:", fundTx);

const fundReceipt = await publicClient.waitForTransactionReceipt({
  hash: fundTx,
  confirmations: 1,
  timeout: 300_000,
});
if (fundReceipt.status !== "success") {
  throw new Error(`Fund failed: ${fundTx}`);
}

const finalBalance = await distributor.read.tokenBalance();
console.log("distributor BQR balance:", formatUnits(finalBalance, 18));
