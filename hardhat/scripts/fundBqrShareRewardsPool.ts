/**
 * Fund the deployed BqrShareRewardsPool with BQR (owner signer).
 *
 * Repeatable: there is NO lifetime pool cap. Call again whenever the pool
 * balance is low. Default amount is 10000 BQR (18 decimals), overridable.
 *
 * DO NOT run this script in Phase 1. Local implementation / testing only.
 * This script does not interact with RewardsDistributor.
 *
 * Prerequisites (hardhat/.env):
 *   BASE_RPC_URL=...
 *   DEPLOYER_PRIVATE_KEY=...        (must be BqrShareRewardsPool owner)
 *   BQR_SHARE_REWARDS_POOL=0x...    (deployed pool address)
 *   FUND_AMOUNT_BQR=10000           (optional whole-token amount; default 10000)
 *
 * Run (later phase only):
 *   npx hardhat run scripts/fundBqrShareRewardsPool.ts --network base --build-profile production
 */
import "dotenv/config";

import { network } from "hardhat";
import {
  erc20Abi,
  formatUnits,
  getAddress,
  isAddress,
  parseEther,
  zeroAddress,
  type Hex,
} from "viem";
import { base } from "viem/chains";

import {
  assertFundPoolGuards,
  BQR_TOKEN,
  REWARDS_DISTRIBUTOR_ADDRESS,
} from "./lib/bqrShareRewardsPoolGuards.js";

const poolRaw = process.env.BQR_SHARE_REWARDS_POOL?.trim();
if (!poolRaw || !isAddress(poolRaw, { strict: false })) {
  throw new Error(
    "BQR_SHARE_REWARDS_POOL must be set to the deployed BqrShareRewardsPool address",
  );
}
const POOL = getAddress(poolRaw);
if (POOL === zeroAddress) {
  throw new Error("BQR_SHARE_REWARDS_POOL must not be the zero address");
}
if (POOL === REWARDS_DISTRIBUTOR_ADDRESS) {
  throw new Error(
    `Refusing to fund RewardsDistributor (${REWARDS_DISTRIBUTOR_ADDRESS}). Set BQR_SHARE_REWARDS_POOL to the BqrShareRewardsPool address.`,
  );
}

const amountRaw = process.env.FUND_AMOUNT_BQR?.trim() || "10000";
if (!/^\d+$/.test(amountRaw) || amountRaw === "0") {
  throw new Error("FUND_AMOUNT_BQR must be a positive whole-token integer");
}
const FUND_AMOUNT = parseEther(amountRaw);

const connection = await network.create({
  network: "base",
  chainType: "op",
});

const { viem } = connection;
const publicClient = await viem.getPublicClient();
const [owner] = await viem.getWalletClients();
const ownerAddress = getAddress(owner.account.address);

const pool = await viem.getContractAt("BqrShareRewardsPool", POOL);

const chainId = await publicClient.getChainId();
const onChainOwner = getAddress(await pool.read.owner());
const onChainToken = getAddress(await pool.read.bqrToken());
const onChainReward = await pool.read.rewardAmount();

assertFundPoolGuards({
  chainId,
  poolAddress: POOL,
  deployer: ownerAddress,
  owner: onChainOwner,
  bqrToken: onChainToken,
  rewardAmount: onChainReward,
});

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
  args: [ownerAddress, POOL],
})) as bigint;

let approveTx: Hex | null = null;
if (allowance < FUND_AMOUNT) {
  approveTx = await owner.writeContract({
    address: BQR_TOKEN,
    abi: erc20Abi,
    functionName: "approve",
    args: [POOL, FUND_AMOUNT],
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
    "approve tx: (skipped — allowance already >= fund amount)",
    `allowance=${formatUnits(allowance, 18)}`,
  );
}

const fundTx = await pool.write.fund([FUND_AMOUNT], {
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

const finalBalance = await pool.read.tokenBalance();
console.log("pool BQR balance:", formatUnits(finalBalance, 18));
console.log("funded amount:", formatUnits(FUND_AMOUNT, 18));
