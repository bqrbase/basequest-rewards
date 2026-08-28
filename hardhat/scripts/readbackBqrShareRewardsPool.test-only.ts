/**
 * Read-only post-deploy check. Does not send transactions.
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, formatEther, getAddress, http } from "viem";
import { base } from "viem/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../.env") });
loadEnv({
  path: path.resolve(__dirname, "../../.env.local"),
  override: true,
});

const LIVE_POOL = getAddress("0x967EdCDcf74d6793F1c6d09a1056ec66481513cB");
const NEW_POOL = getAddress("0x75b99B36DDc4206A3c3A5d89436606e637003151");
const OWNER = getAddress("0xD34f706D5a5567FC0d45eFFa1623a37B66Ea41a2");
const BQR = getAddress("0xB200000000000000000000Bf7E6dcf0cF466939a");

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
if (!rpc) throw new Error("Missing BASE_RPC_URL");
const client = createPublicClient({
  chain: base,
  transport: http(rpc, { retryCount: 6, retryDelay: 2_000, timeout: 30_000 }),
});

async function readPool(address: typeof LIVE_POOL | typeof NEW_POOL) {
  const [owner, bqrToken, tokenBalance, totalPaid, rewardAmount, bytecode] =
    await Promise.all([
      client.readContract({ address, abi: poolAbi, functionName: "owner" }),
      client.readContract({ address, abi: poolAbi, functionName: "bqrToken" }),
      client.readContract({
        address,
        abi: poolAbi,
        functionName: "tokenBalance",
      }),
      client.readContract({ address, abi: poolAbi, functionName: "totalPaid" }),
      client.readContract({
        address,
        abi: poolAbi,
        functionName: "rewardAmount",
      }),
      client.getCode({ address }),
    ]);
  return {
    address,
    owner,
    bqrToken,
    tokenBalance: tokenBalance.toString(),
    tokenBalanceBqr: formatEther(tokenBalance),
    totalPaid: totalPaid.toString(),
    rewardAmount: rewardAmount.toString(),
    bytecodeBytes: bytecode && bytecode !== "0x" ? (bytecode.length - 2) / 2 : 0,
    hasBytecode: Boolean(bytecode && bytecode !== "0x"),
  };
}

const [testOnly, live] = await Promise.all([readPool(NEW_POOL), readPool(LIVE_POOL)]);

console.log(
  JSON.stringify(
    {
      testOnly,
      liveUntouched: live,
      checks: {
        testOnlyIsNotLive: testOnly.address !== live.address,
        testOnlyOwner: testOnly.owner === OWNER,
        testOnlyToken: testOnly.bqrToken === BQR,
        testOnlyUnfunded: testOnly.tokenBalance === "0",
        testOnlyReward25e18: testOnly.rewardAmount === "25000000000000000000",
        liveStillHolds10000Bqr: live.tokenBalance === "10000000000000000000000",
      },
    },
    null,
    2,
  ),
);
