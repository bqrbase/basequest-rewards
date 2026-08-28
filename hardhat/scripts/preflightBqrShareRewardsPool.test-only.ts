/**
 * Read-only Base Mainnet preflight for TEST-ONLY BqrShareRewardsPool deploy.
 * Does not send transactions. Does not touch the live pool.
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  formatEther,
  getAddress,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../.env") });
loadEnv({
  path: path.resolve(__dirname, "../../.env.local"),
  override: true,
});

const LIVE_POOL = getAddress("0x967EdCDcf74d6793F1c6d09a1056ec66481513cB");
const OWNER = getAddress("0xD34f706D5a5567FC0d45eFFa1623a37B66Ea41a2");
const BQR = getAddress("0xB200000000000000000000Bf7E6dcf0cF466939a");
const DISTRIBUTOR = getAddress("0x8DB0F6a276242787f8DA48360898cC3B5FC0bCe9");

const poolAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "bqrToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "tokenBalance",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalPaid",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "rewardAmount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

const rpc = process.env.BASE_RPC_URL;
const rawKey = process.env.DEPLOYER_PRIVATE_KEY?.trim();
if (!rpc) {
  throw new Error("Missing BASE_RPC_URL");
}
if (!rawKey) {
  throw new Error("Missing DEPLOYER_PRIVATE_KEY");
}
const key = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
const deployer = privateKeyToAccount(key);

const client = createPublicClient({
  chain: base,
  transport: http(rpc, { retryCount: 6, retryDelay: 2_000, timeout: 30_000 }),
});

async function pause() {
  await new Promise((resolve) => setTimeout(resolve, 400));
}

const chainId = await client.getChainId();
await pause();
const eth = await client.getBalance({ address: deployer.address });
await pause();
const nonce = await client.getTransactionCount({ address: deployer.address });
await pause();

const liveOwner = await client.readContract({
  address: LIVE_POOL,
  abi: poolAbi,
  functionName: "owner",
});
await pause();
const liveToken = await client.readContract({
  address: LIVE_POOL,
  abi: poolAbi,
  functionName: "bqrToken",
});
await pause();
const liveBal = await client.readContract({
  address: LIVE_POOL,
  abi: poolAbi,
  functionName: "tokenBalance",
});
await pause();
const livePaid = await client.readContract({
  address: LIVE_POOL,
  abi: poolAbi,
  functionName: "totalPaid",
});
await pause();
const liveReward = await client.readContract({
  address: LIVE_POOL,
  abi: poolAbi,
  functionName: "rewardAmount",
});
await pause();
const liveCode = await client.getCode({ address: LIVE_POOL });
await pause();
const tokenCode = await client.getCode({ address: BQR });

const unexpected: string[] = [];
if (chainId !== 8453) unexpected.push("chainId is not 8453");
if (getAddress(deployer.address) === OWNER) {
  unexpected.push("deployer equals pool owner");
}
if (getAddress(deployer.address) === LIVE_POOL) {
  unexpected.push("deployer equals live pool");
}
if (LIVE_POOL === DISTRIBUTOR) unexpected.push("live pool is RewardsDistributor");
if (getAddress(liveOwner) !== OWNER) unexpected.push("live pool owner mismatch");
if (getAddress(liveToken) !== BQR) unexpected.push("live pool token mismatch");
if (eth === 0n) unexpected.push("deployer ETH balance is 0");
if (!liveCode || liveCode === "0x") unexpected.push("live pool has no bytecode");
if (!tokenCode || tokenCode === "0x") unexpected.push("BQR token has no bytecode");

console.log(
  JSON.stringify(
    {
      preflight: "read-only",
      willBroadcast: false,
      target: "NEW BqrShareRewardsPool only",
      livePoolUntouched: LIVE_POOL,
      chainId,
      deployer: deployer.address,
      deployerIsNotOwner: getAddress(deployer.address) !== OWNER,
      deployerEth: formatEther(eth),
      deployerNonce: nonce,
      rpcHost: new URL(rpc).host,
      constructor: { initialOwner: OWNER, bqrToken: BQR },
      livePool: {
        address: LIVE_POOL,
        owner: liveOwner,
        bqrToken: liveToken,
        tokenBalance: liveBal.toString(),
        tokenBalanceBqr: formatEther(liveBal),
        totalPaid: livePaid.toString(),
        rewardAmount: liveReward.toString(),
        bytecodeBytes:
          liveCode && liveCode !== "0x" ? (liveCode.length - 2) / 2 : 0,
      },
      unexpected,
    },
    null,
    2,
  ),
);

if (unexpected.length > 0) {
  process.exitCode = 2;
}
