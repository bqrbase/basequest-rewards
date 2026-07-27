import { weiToString } from "@/lib/rewards/amounts";
import { buildMerkleTree, claimLeaf } from "@/lib/rewards/merkleTree";
import { expandEligibleToAllocations } from "@/lib/rewards/server/allocationPlan";
import {
  evaluateWalletPending,
  listRewardUserWallets,
  loadSuccessfulReferralCountMap,
} from "@/lib/rewards/server/eligibility";
import {
  readBqrDecimals,
  readOnChainCampaign,
} from "@/lib/rewards/server/baseClient";
import {
  deleteAllocationsForCampaign,
  insertRewardAllocations,
  listAllocationsForCampaign,
  listAllPriorAllocationsSummary,
  type InsertRewardAllocation,
} from "@/lib/supabase/rewardAllocations";
import {
  createRewardCampaign,
  getRewardCampaign,
  listRewardCampaigns,
  updateRewardCampaign,
  type CreateRewardCampaignInput,
  type RewardCampaignRow,
} from "@/lib/supabase/rewardCampaigns";
import { getAddress, type Address, type Hex } from "viem";

/**
 * Campaign lifecycle (off-chain metadata only):
 *
 * draft → snapshot (eligibility, no Merkle)
 *      → build (Merkle root + proofs; leaf has no campaignId)
 *      → external createCampaign(root) + fund
 *      → link (bind actual CampaignCreated id; require root equality)
 *
 * Leaves are keccak256(account, rewardId, amount). Replay isolation remains
 * claimId = keccak256(campaignId, account, rewardId). No campaignId prediction.
 *
 * Never sends privileged txs. Never stores private keys.
 */

const ZERO_ROOT =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

export async function createDraftCampaign(
  input: CreateRewardCampaignInput,
): Promise<RewardCampaignRow> {
  if (!input.name?.trim()) {
    throw new Error("Campaign name is required");
  }
  if (
    input.endTime !== undefined &&
    input.endTime !== 0 &&
    input.startTime !== undefined &&
    input.endTime <= input.startTime
  ) {
    throw new Error("endTime must be 0 (no expiry) or greater than startTime");
  }
  return createRewardCampaign(input);
}

export async function listCampaigns(): Promise<RewardCampaignRow[]> {
  return listRewardCampaigns();
}

export type SnapshotCampaignResult = {
  campaign: RewardCampaignRow;
  allocationCount: number;
  totalAmountWei: string;
  note: string;
};

/**
 * Snapshot eligibility into allocation rows without Merkle materialization.
 */
export async function snapshotCampaignEligibility(params: {
  campaignUuid: string;
}): Promise<SnapshotCampaignResult> {
  const campaign = await getRewardCampaign(params.campaignUuid);
  if (!campaign) {
    throw new Error("Campaign not found");
  }
  if (
    campaign.status !== "draft" &&
    campaign.status !== "snapshotted" &&
    campaign.status !== "ready"
  ) {
    throw new Error(
      `Cannot snapshot campaign in status "${campaign.status}" (expected draft, snapshotted, or ready)`,
    );
  }

  const decimals = await readBqrDecimals();
  const [users, referralCounts] = await Promise.all([
    listRewardUserWallets(),
    loadSuccessfulReferralCountMap(),
  ]);

  await deleteAllocationsForCampaign(campaign.id);
  // Drop orphan allocation rows left by interrupted snapshots (draft + leaf_count=0).
  {
    const drafts = (await listRewardCampaigns()).filter(
      (c) =>
        c.id !== campaign.id &&
        c.status === "draft" &&
        Number(c.leaf_count ?? 0) === 0,
    );
    for (const draft of drafts) {
      await deleteAllocationsForCampaign(draft.id);
    }
  }
  const priorFresh = await listAllPriorAllocationsSummary();

  const planned = [];
  for (const user of users) {
    const prior = priorFresh.get(user.wallet) ?? {
      actionKeys: new Set<string>(),
      referralUnitMax: 0,
    };

    const claimedActionIds = [...prior.actionKeys].filter(
      (k) => !k.startsWith("referral:"),
    );
    const pending = evaluateWalletPending({
      isWalletConnected: true,
      completedQuestIds: user.completedQuestIds,
      successfulReferralCount: referralCounts.get(user.wallet) ?? 0,
      claimedActionIds,
      claimedReferralCount: prior.referralUnitMax,
    });

    const expansions = expandEligibleToAllocations({
      wallet: user.wallet,
      eligibleItems: pending.items,
      priorReferralUnitMax: prior.referralUnitMax,
      priorActionKeys: prior.actionKeys,
      decimals,
    });
    planned.push(...expansions);
  }

  if (planned.length === 0) {
    await updateRewardCampaign(campaign.id, {
      status: "draft",
      merkle_root: null,
      on_chain_campaign_id: null,
      leaf_count: 0,
      total_amount_wei: "0",
      bqr_decimals: decimals,
      build_error: "No eligible allocations at snapshot time",
      built_at: null,
    });
    throw new Error("No eligible allocations to include in this campaign");
  }

  planned.sort((a, b) => {
    const w = a.wallet.localeCompare(b.wallet);
    if (w !== 0) return w;
    return a.actionKey.localeCompare(b.actionKey);
  });

  let total = BigInt(0);
  // Leaf = keccak256(account, rewardId, amount) — no campaignId — so hashes
  // are known at snapshot. Persist hash + provisional index so DBs that still
  // require NOT NULL leaf_hash/leaf_index succeed; build() rewrites proofs.
  const insertRows: InsertRewardAllocation[] = planned.map((row, leafIndex) => {
    total += row.amountWei;
    return {
      campaign_id: campaign.id,
      wallet_address: row.wallet,
      action_key: row.actionKey,
      reward_id: row.rewardId,
      amount_bqr: row.amountBqr,
      amount_wei: weiToString(row.amountWei),
      leaf_hash: claimLeaf({
        account: getAddress(row.wallet as Address),
        rewardId: row.rewardId as Hex,
        amount: row.amountWei,
      }),
      leaf_index: leafIndex,
      merkle_proof: [],
    };
  });

  await insertRewardAllocations(insertRows);

  const snapshotPatch = {
    merkle_root: null as string | null,
    on_chain_campaign_id: null as number | null,
    leaf_count: insertRows.length,
    total_amount_wei: weiToString(total),
    bqr_decimals: decimals,
    build_error: null as string | null,
    built_at: null as string | null,
    published_at: null as string | null,
  };

  // Prefer status "snapshotted". Some prod DBs still lack that enum value
  // (migration 20260727); fall back to draft with allocations persisted.
  let updated: RewardCampaignRow;
  try {
    updated = await updateRewardCampaign(campaign.id, {
      ...snapshotPatch,
      status: "snapshotted",
    });
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : error instanceof Error
          ? error.message
          : String(error);
    if (!/reward_campaigns_status_check|snapshotted/i.test(message)) {
      throw error;
    }
    updated = await updateRewardCampaign(campaign.id, {
      ...snapshotPatch,
      status: "draft",
    });
  }

  return {
    campaign: updated,
    allocationCount: insertRows.length,
    totalAmountWei: weiToString(total),
    note:
      "Eligibility snapshotted. POST .../build to materialize the Merkle root " +
      "(no campaignId in leaves), then createCampaign(root) externally, then POST .../link.",
  };
}

export type BuildCampaignResult = {
  campaign: RewardCampaignRow;
  merkleRoot: Hex;
  leafCount: number;
  totalAmountWei: string;
  opsInstructions: {
    createCampaignArgs: {
      campaignType: number;
      merkleRoot: Hex;
      startTime: number;
      endTime: number;
    };
    note: string;
  };
};

function sortAllocationRows<
  T extends { wallet_address: string; action_key: string },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const w = a.wallet_address.localeCompare(b.wallet_address);
    if (w !== 0) return w;
    return a.action_key.localeCompare(b.action_key);
  });
}

function leavesFromAllocations(
  rows: Array<{
    wallet_address: string;
    reward_id: string;
    amount_wei: string | number;
  }>,
): Hex[] {
  return rows.map((row) =>
    claimLeaf({
      account: getAddress(row.wallet_address as Address),
      rewardId: row.reward_id as Hex,
      amount: BigInt(String(row.amount_wei)),
    }),
  );
}

/**
 * Compute Merkle root for snapshotted allocations (no campaignId in leaf).
 * Does not persist proofs. Useful for inspection; prefer build for publish.
 */
export async function computeMerkleRootForSnapshot(params: {
  campaignUuid: string;
}): Promise<{ merkleRoot: Hex; leafCount: number }> {
  const campaign = await getRewardCampaign(params.campaignUuid);
  if (!campaign) {
    throw new Error("Campaign not found");
  }
  if (
    campaign.status !== "draft" &&
    campaign.status !== "snapshotted" &&
    campaign.status !== "ready"
  ) {
    throw new Error(
      `Cannot compute root in status "${campaign.status}" (expected draft, snapshotted, or ready)`,
    );
  }

  const existing = await listAllocationsForCampaign(campaign.id);
  if (existing.length === 0) {
    throw new Error("No snapshotted allocations found");
  }

  const ordered = sortAllocationRows(existing);
  const leaves = leavesFromAllocations(ordered);
  const { root } = buildMerkleTree(leaves);

  return { merkleRoot: root, leafCount: leaves.length };
}

/**
 * Materialize OZ Merkle leaves/proofs and store root.
 * Root does not depend on on-chain campaignId — safe to createCampaign afterward.
 */
export async function buildCampaignMerkle(params: {
  campaignUuid: string;
}): Promise<BuildCampaignResult> {
  const campaign = await getRewardCampaign(params.campaignUuid);
  if (!campaign) {
    throw new Error("Campaign not found");
  }
  if (
    campaign.status !== "draft" &&
    campaign.status !== "snapshotted" &&
    campaign.status !== "ready"
  ) {
    throw new Error(
      `Cannot build campaign in status "${campaign.status}" (expected draft, snapshotted, or ready)`,
    );
  }

  const existing = await listAllocationsForCampaign(campaign.id);
  if (existing.length === 0) {
    throw new Error(
      "No snapshotted allocations found. POST .../snapshot before build.",
    );
  }

  const ordered = sortAllocationRows(existing);
  const leaves = leavesFromAllocations(ordered);
  const { root, proofs } = buildMerkleTree(leaves);

  await deleteAllocationsForCampaign(campaign.id);

  let total = BigInt(0);
  const insertRows: InsertRewardAllocation[] = ordered.map((row, leafIndex) => {
    const amountWei = BigInt(String(row.amount_wei));
    total += amountWei;
    return {
      campaign_id: campaign.id,
      wallet_address: row.wallet_address,
      action_key: row.action_key,
      reward_id: row.reward_id as Hex,
      amount_bqr: Number(row.amount_bqr),
      amount_wei: weiToString(amountWei),
      leaf_hash: leaves[leafIndex],
      leaf_index: leafIndex,
      merkle_proof: proofs[leafIndex],
    };
  });

  await insertRewardAllocations(insertRows);

  const updated = await updateRewardCampaign(campaign.id, {
    status: "ready",
    merkle_root: root.toLowerCase(),
    on_chain_campaign_id: null,
    leaf_count: insertRows.length,
    total_amount_wei: weiToString(total),
    build_error: null,
    built_at: new Date().toISOString(),
  });

  return {
    campaign: updated,
    merkleRoot: root,
    leafCount: insertRows.length,
    totalAmountWei: weiToString(total),
    opsInstructions: {
      createCampaignArgs: {
        campaignType: updated.campaign_type,
        merkleRoot: root,
        startTime: updated.start_time,
        endTime: updated.end_time,
      },
      note:
        "Call createCampaign + fund externally with this merkleRoot, then POST .../link " +
        "with the campaignId from CampaignCreated. Leaves do not encode campaignId.",
    },
  };
}

export class CampaignRootMismatchError extends Error {
  computedRoot: Hex;
  onChainRoot: Hex;
  onChainCampaignId: number;

  constructor(params: {
    computedRoot: Hex;
    onChainRoot: Hex;
    onChainCampaignId: number;
  }) {
    super(
      `On-chain merkle root mismatch for campaign ${params.onChainCampaignId}. ` +
        `expected=${params.computedRoot} onChain=${params.onChainRoot}.`,
    );
    this.name = "CampaignRootMismatchError";
    this.computedRoot = params.computedRoot;
    this.onChainRoot = params.onChainRoot;
    this.onChainCampaignId = params.onChainCampaignId;
  }
}

/**
 * Bind an existing on-chain campaign id after createCampaign(root).
 * Requires getCampaign(id).merkleRoot == stored ready root.
 */
export async function linkCampaignOnChain(params: {
  campaignUuid: string;
  onChainCampaignId: number;
}): Promise<RewardCampaignRow> {
  const campaign = await getRewardCampaign(params.campaignUuid);
  if (!campaign) {
    throw new Error("Campaign not found");
  }
  if (campaign.status !== "ready") {
    throw new Error(
      `Campaign must be ready to link (got ${campaign.status}). Snapshot → build → create on-chain first.`,
    );
  }
  if (!campaign.merkle_root) {
    throw new Error("Campaign has no merkle root — POST .../build first");
  }

  const onChainId = params.onChainCampaignId;
  if (!Number.isInteger(onChainId) || onChainId < 1) {
    throw new Error(
      "onChainCampaignId is required (actual id from CampaignCreated)",
    );
  }

  const onChain = await readOnChainCampaign(BigInt(onChainId));
  if (!onChain.merkleRoot || onChain.merkleRoot.toLowerCase() === ZERO_ROOT) {
    throw new Error(
      `On-chain campaign ${onChainId} does not exist (empty merkle root)`,
    );
  }

  if (
    onChain.merkleRoot.toLowerCase() !== campaign.merkle_root.toLowerCase()
  ) {
    throw new CampaignRootMismatchError({
      computedRoot: campaign.merkle_root as Hex,
      onChainRoot: onChain.merkleRoot,
      onChainCampaignId: onChainId,
    });
  }

  return updateRewardCampaign(campaign.id, {
    status: "published",
    on_chain_campaign_id: onChainId,
    published_at: new Date().toISOString(),
    start_time: Number(onChain.startTime),
    end_time: Number(onChain.endTime),
    campaign_type: onChain.campaignType,
  });
}

export async function closeCampaign(
  campaignUuid: string,
): Promise<RewardCampaignRow> {
  const campaign = await getRewardCampaign(campaignUuid);
  if (!campaign) {
    throw new Error("Campaign not found");
  }
  return updateRewardCampaign(campaignUuid, { status: "closed" });
}

export type { Address, Hex };
