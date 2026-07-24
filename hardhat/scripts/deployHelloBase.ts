/**
 * Deploy HelloBase to Base Sepolia.
 *
 * Prerequisites (in .env):
 *   BASE_SEPOLIA_RPC_URL=...
 *   DEPLOYER_PRIVATE_KEY=...
 *
 * Run manually when ready (does not run automatically):
 *   npx hardhat run scripts/deployHelloBase.ts --network baseSepolia
 *
 * This script does not connect an app wallet — it uses the deployer key
 * from Hardhat network config only.
 */
import { network } from "hardhat";

const connection = await network.create({
  network: "baseSepolia",
  chainType: "op",
});

const { viem } = connection;
const [deployer] = await viem.getWalletClients();

console.log("Network: baseSepolia");
console.log("Deployer:", deployer.account.address);

const helloBase = await viem.deployContract("HelloBase");

console.log("HelloBase deployed to:", helloBase.address);

const message = await helloBase.read.message();
console.log("message:", message);
