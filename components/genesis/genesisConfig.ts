export const GENESIS_CONTRACT_ADDRESS =
  "0xf7847b5A30BF59e3B263A2FD560103027Fe81Dd3" as const;

export const GENESIS_BASESCAN_URL =
  `https://basescan.org/address/${GENESIS_CONTRACT_ADDRESS}` as const;

export const GENESIS_OPENSEA_URL =
  `https://opensea.io/assets/base/${GENESIS_CONTRACT_ADDRESS}/1` as const;

export const GENESIS_WEBSITE_URL = "https://basequest.online" as const;

export const GENESIS_IMAGE_URL =
  "https://basequest.online/images/genesis.png" as const;

export const GENESIS_STATUS_ITEMS = [
  "Verified Contract",
  "Base Mainnet",
  "Collection Live",
] as const;

export const GENESIS_DETAILS = [
  { label: "Blockchain", value: "Base" },
  { label: "Token Standard", value: "ERC-1155" },
  { label: "Collection Size", value: "1000" },
  { label: "Royalty", value: "5%" },
  { label: "Status", value: "Live" },
] as const;

export const GENESIS_WHY_HOLD = [
  {
    title: "Lifetime Genesis Badge",
    description: "A permanent mark of founding support in the BaseQuest ecosystem.",
    icon: "badge" as const,
  },
  {
    title: "Future Airdrop Eligibility",
    description: "Stay positioned for future reward and airdrop programs.",
    icon: "gift" as const,
  },
  {
    title: "Exclusive Community Campaigns",
    description: "Access holder-focused campaigns and community activations.",
    icon: "users" as const,
  },
  {
    title: "Priority Access",
    description: "Move to the front of the line for upcoming BaseQuest releases.",
    icon: "zap" as const,
  },
  {
    title: "XP Boost Opportunities",
    description: "Unlock potential XP advantages across future BaseQuest experiences.",
    icon: "trending" as const,
  },
  {
    title: "Early Access to Future BaseQuest Features",
    description: "Get earlier access as new utilities and product surfaces ship.",
    icon: "sparkles" as const,
  },
] as const;

export const GENESIS_ROADMAP = [
  {
    title: "Genesis Collection Deployed",
    status: "complete" as const,
  },
  {
    title: "Smart Contract Verified",
    status: "complete" as const,
  },
  {
    title: "First NFT Minted",
    status: "complete" as const,
  },
  {
    title: "Community Distribution",
    status: "upcoming" as const,
  },
  {
    title: "Holder Utilities",
    status: "upcoming" as const,
  },
  {
    title: "Future Rewards",
    status: "upcoming" as const,
  },
] as const;
