/**
 * RewardsDistributor ABI (compiled with solc 0.8.28 via Hardhat).
 * Source: hardhat/contracts/RewardsDistributor.sol
 *
 * Deploy once, then set NEXT_PUBLIC_REWARDS_DISTRIBUTOR.
 * Trimmed to the claim path + views needed by the app helper.
 */
export const REWARDS_DISTRIBUTOR_ABI = [
  {
    type: "error",
    name: "AlreadyClaimed",
    inputs: [
      { name: "claimId", type: "bytes32", internalType: "bytes32" },
    ],
  },
  { type: "error", name: "CampaignEnded", inputs: [] },
  { type: "error", name: "CampaignInactive", inputs: [] },
  { type: "error", name: "CampaignNotFound", inputs: [] },
  { type: "error", name: "CampaignNotStarted", inputs: [] },
  { type: "error", name: "ClaimKeyZero", inputs: [] },
  { type: "error", name: "EnforcedPause", inputs: [] },
  { type: "error", name: "InvalidAmount", inputs: [] },
  { type: "error", name: "InvalidProof", inputs: [] },
  { type: "error", name: "RootNotSet", inputs: [] },
  { type: "error", name: "ZeroAddress", inputs: [] },
  { type: "error", name: "ReentrancyGuardReentrantCall", inputs: [] },
  {
    type: "error",
    name: "SafeERC20FailedOperation",
    inputs: [{ name: "token", type: "address", internalType: "address" }],
  },
  {
    type: "event",
    name: "RewardClaimed",
    inputs: [
      {
        name: "account",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "campaignId",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "claimId",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "rewardId",
        type: "bytes32",
        indexed: false,
        internalType: "bytes32",
      },
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
  },
  {
    type: "function",
    name: "bqrToken",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract IERC20" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "campaignCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "claim",
    inputs: [
      { name: "campaignId", type: "uint256", internalType: "uint256" },
      { name: "rewardId", type: "bytes32", internalType: "bytes32" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      {
        name: "merkleProof",
        type: "bytes32[]",
        internalType: "bytes32[]",
      },
    ],
    outputs: [{ name: "claimId", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getCampaign",
    inputs: [
      { name: "campaignId", type: "uint256", internalType: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct RewardsDistributor.Campaign",
        components: [
          {
            name: "merkleRoot",
            type: "bytes32",
            internalType: "bytes32",
          },
          { name: "startTime", type: "uint64", internalType: "uint64" },
          { name: "endTime", type: "uint64", internalType: "uint64" },
          { name: "active", type: "bool", internalType: "bool" },
          {
            name: "campaignType",
            type: "uint8",
            internalType: "uint8",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getClaimId",
    inputs: [
      { name: "campaignId", type: "uint256", internalType: "uint256" },
      { name: "account", type: "address", internalType: "address" },
      { name: "rewardId", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "isClaimed",
    inputs: [
      { name: "campaignId", type: "uint256", internalType: "uint256" },
      { name: "account", type: "address", internalType: "address" },
      { name: "rewardId", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isClaimed",
    inputs: [{ name: "claimId", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "paused",
    inputs: [],
    outputs: [{ name: "", type: "bool", internalType: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenBalance",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const;

export default REWARDS_DISTRIBUTOR_ABI;
