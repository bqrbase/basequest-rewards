/**
 * BaseQuestBadge ABI (compiled with solc 0.8.28 via Hardhat).
 * Source: hardhat/contracts/BaseQuestBadge.sol
 *
 * Deploy once, then set NEXT_PUBLIC_BASEQUEST_BADGE_ADDRESS.
 */
export const BASEQUEST_BADGE_ABI = [
  {
    type: "error",
    name: "AlreadyMinted",
    inputs: [],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      {
        name: "from",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "to",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "tokenId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
    ],
  },
  {
    type: "function",
    name: "claim",
    inputs: [],
    outputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "hasMinted",
    inputs: [{ name: "", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
] as const;

export default BASEQUEST_BADGE_ABI;
