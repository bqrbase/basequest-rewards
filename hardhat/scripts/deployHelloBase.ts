/**
 * Deploy HelloBase to Base Mainnet.
 *
 * Prerequisites (in hardhat/.env):
 *   BASE_RPC_URL=https://mainnet.base.org
 *   DEPLOYER_PRIVATE_KEY=...
 *
 * Run:
 *   npx hardhat run scripts/deployHelloBase.ts --network base
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

const helloBase = await viem.deployContract("HelloBase");

console.log("HelloBase deployed to:", helloBase.address);

const message = await helloBase.read.message();
console.log("message:", message);
