/**
 * Server-only rewards Merkle backend.
 * Do not import from client components.
 */

export {
  assertRewardsAdmin,
  isRewardsAdminConfigured,
  RewardsAdminAuthError,
} from "@/lib/rewards/server/adminAuth";
export {
  buildCampaignMerkle,
  CampaignRootMismatchError,
  closeCampaign,
  computeMerkleRootForSnapshot,
  createDraftCampaign,
  linkCampaignOnChain,
  listCampaigns,
  snapshotCampaignEligibility,
} from "@/lib/rewards/server/campaignService";
export {
  syncCampaignClaims,
  syncWalletClaims,
} from "@/lib/rewards/server/claimSync";
export { getPendingRewardsForWallet } from "@/lib/rewards/server/pendingService";
export {
  ClaimProofAlreadyClaimedError,
  ClaimProofNotFoundError,
  getClaimProof,
} from "@/lib/rewards/server/proofService";
