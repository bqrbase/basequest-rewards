import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import {
  encodePacked,
  keccak256,
  parseEther,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";

import { buildMerkleTree, claimLeaf } from "./helpers/merkle.js";

const REWARD_ID = keccak256(encodePacked(["string"], ["daily-check-in"]));
const CLAIM_AMOUNT = parseEther("100");
const FUND_AMOUNT = parseEther("1000");

describe("RewardsDistributor", async function () {
  const { viem, networkHelpers } = await network.create();

  async function deployFixture() {
    const [owner, user, other] = await viem.getWalletClients();
    const token = await viem.deployContract("MockERC20");
    const distributor = await viem.deployContract("RewardsDistributor", [
      owner.account.address,
      token.address,
    ]);

    return {
      owner,
      user,
      other,
      token,
      distributor,
      ownerAddress: owner.account.address as Address,
      userAddress: user.account.address as Address,
    };
  }

  function leafFor(
    account: Address,
    amount: bigint = CLAIM_AMOUNT,
    rewardId: Hex = REWARD_ID,
  ) {
    return claimLeaf({ account, rewardId, amount });
  }

  async function createFundedClaimableCampaign(params?: {
    startTime?: bigint;
    endTime?: bigint;
    fundAmount?: bigint;
    active?: boolean;
    includeOtherLeaf?: boolean;
  }) {
    const ctx = await networkHelpers.loadFixture(deployFixture);
    const now = BigInt(await networkHelpers.time.latest());
    const startTime = params?.startTime ?? 0n;
    const endTime = params?.endTime ?? 0n;

    const campaignId = 1n;
    const userLeaf = leafFor(ctx.userAddress);
    const leaves = params?.includeOtherLeaf
      ? [userLeaf, leafFor(ctx.other.account.address as Address)]
      : [userLeaf];
    const { root, proofs } = buildMerkleTree(leaves);
    const userProof = proofs[0];

    await ctx.distributor.write.createCampaign(
      [0, root, startTime, endTime],
      { account: ctx.owner.account },
    );

    if (params?.active === false) {
      await ctx.distributor.write.setCampaignActive([campaignId, false], {
        account: ctx.owner.account,
      });
    }

    const fundAmount = params?.fundAmount ?? FUND_AMOUNT;
    if (fundAmount > 0n) {
      await ctx.token.write.mint([ctx.ownerAddress, fundAmount], {
        account: ctx.owner.account,
      });
      await ctx.token.write.approve([ctx.distributor.address, fundAmount], {
        account: ctx.owner.account,
      });
      await ctx.distributor.write.fund([fundAmount], {
        account: ctx.owner.account,
      });
    }

    return {
      ...ctx,
      campaignId,
      root,
      userProof,
      now,
    };
  }

  /*//////////////////////////////////////////////////////////////
                              DEPLOYMENT
  //////////////////////////////////////////////////////////////*/

  describe("Deployment", function () {
    it("sets the correct owner", async function () {
      const { owner, distributor, ownerAddress } =
        await networkHelpers.loadFixture(deployFixture);

      assert.equal(
        (await distributor.read.owner()).toLowerCase(),
        ownerAddress.toLowerCase(),
      );
      assert.ok(owner.account.address);
    });

    it("sets the correct BQR token address", async function () {
      const { token, distributor } =
        await networkHelpers.loadFixture(deployFixture);

      assert.equal(
        (await distributor.read.bqrToken()).toLowerCase(),
        token.address.toLowerCase(),
      );
    });

    it("rejects a zero BQR token address", async function () {
      const [owner] = await viem.getWalletClients();
      await assert.rejects(() =>
        viem.deployContract("RewardsDistributor", [
          owner.account.address,
          zeroAddress,
        ]),
      );
    });
  });

  /*//////////////////////////////////////////////////////////////
                         CAMPAIGN MANAGEMENT
  //////////////////////////////////////////////////////////////*/

  describe("Campaign management", function () {
    it("createCampaign succeeds and stores fields", async function () {
      const { distributor, owner } =
        await networkHelpers.loadFixture(deployFixture);
      const root = keccak256(encodePacked(["string"], ["root"]));
      const start = 100n;
      const end = 200n;

      await viem.assertions.emitWithArgs(
        distributor.write.createCampaign([1, root, start, end], {
          account: owner.account,
        }),
        distributor,
        "CampaignCreated",
        [1n, 1, root, start, end],
      );

      assert.equal(await distributor.read.campaignCount(), 1n);
      const campaign = await distributor.read.getCampaign([1n]);
      assert.equal(campaign.merkleRoot, root);
      assert.equal(campaign.startTime, start);
      assert.equal(campaign.endTime, end);
      assert.equal(campaign.active, true);
      assert.equal(campaign.campaignType, 1);
    });

    it("rejects a zero Merkle root", async function () {
      const { distributor, owner } =
        await networkHelpers.loadFixture(deployFixture);

      await viem.assertions.revertWithCustomError(
        distributor.write.createCampaign(
          [0, `0x${"00".repeat(32)}` as Hex, 0n, 0n],
          { account: owner.account },
        ),
        distributor,
        "RootNotSet",
      );
    });

    it("rejects an invalid time range", async function () {
      const { distributor, owner } =
        await networkHelpers.loadFixture(deployFixture);
      const root = keccak256(encodePacked(["string"], ["root"]));

      await viem.assertions.revertWithCustomError(
        distributor.write.createCampaign([0, root, 100n, 100n], {
          account: owner.account,
        }),
        distributor,
        "InvalidTimeRange",
      );

      await viem.assertions.revertWithCustomError(
        distributor.write.createCampaign([0, root, 200n, 100n], {
          account: owner.account,
        }),
        distributor,
        "InvalidTimeRange",
      );
    });

    it("setCampaignActive enables and disables a campaign", async function () {
      const { distributor, owner } =
        await networkHelpers.loadFixture(deployFixture);
      const root = keccak256(encodePacked(["string"], ["root"]));
      await distributor.write.createCampaign([0, root, 0n, 0n], {
        account: owner.account,
      });

      await viem.assertions.emitWithArgs(
        distributor.write.setCampaignActive([1n, false], {
          account: owner.account,
        }),
        distributor,
        "CampaignActiveUpdated",
        [1n, false],
      );
      assert.equal((await distributor.read.getCampaign([1n])).active, false);

      await distributor.write.setCampaignActive([1n, true], {
        account: owner.account,
      });
      assert.equal((await distributor.read.getCampaign([1n])).active, true);
    });
  });

  /*//////////////////////////////////////////////////////////////
                               FUNDING
  //////////////////////////////////////////////////////////////*/

  describe("Funding", function () {
    it("fund transfers BQR to the distributor", async function () {
      const { token, distributor, owner, ownerAddress } =
        await networkHelpers.loadFixture(deployFixture);

      await token.write.mint([ownerAddress, FUND_AMOUNT], {
        account: owner.account,
      });
      await token.write.approve([distributor.address, FUND_AMOUNT], {
        account: owner.account,
      });

      await viem.assertions.emitWithArgs(
        distributor.write.fund([FUND_AMOUNT], { account: owner.account }),
        distributor,
        "Funded",
        [ownerAddress, FUND_AMOUNT],
      );

      assert.equal(await distributor.read.tokenBalance(), FUND_AMOUNT);
      assert.equal(
        await token.read.balanceOf([distributor.address]),
        FUND_AMOUNT,
      );
    });

    it("rejects zero funding", async function () {
      const { distributor, owner } =
        await networkHelpers.loadFixture(deployFixture);

      await viem.assertions.revertWithCustomError(
        distributor.write.fund([0n], { account: owner.account }),
        distributor,
        "InvalidAmount",
      );
    });
  });

  /*//////////////////////////////////////////////////////////////
                            CLAIM SUCCESS
  //////////////////////////////////////////////////////////////*/

  describe("Claim success", function () {
    it("lets a user claim with a valid Merkle proof", async function () {
      const ctx = await createFundedClaimableCampaign({ includeOtherLeaf: true });

      const balanceBefore = await ctx.token.read.balanceOf([ctx.userAddress]);

      await viem.assertions.emitWithArgs(
        ctx.distributor.write.claim(
          [ctx.campaignId, REWARD_ID, CLAIM_AMOUNT, ctx.userProof],
          { account: ctx.user.account },
        ),
        ctx.distributor,
        "RewardClaimed",
        [
          ctx.userAddress,
          ctx.campaignId,
          await ctx.distributor.read.getClaimId([
            ctx.campaignId,
            ctx.userAddress,
            REWARD_ID,
          ]),
          REWARD_ID,
          CLAIM_AMOUNT,
        ],
      );

      const balanceAfter = await ctx.token.read.balanceOf([ctx.userAddress]);
      assert.equal(balanceAfter - balanceBefore, CLAIM_AMOUNT);
      assert.equal(await ctx.distributor.read.totalClaimed(), CLAIM_AMOUNT);
      assert.equal(
        await ctx.distributor.read.isClaimed([
          ctx.campaignId,
          ctx.userAddress,
          REWARD_ID,
        ]),
        true,
      );
    });
  });

  /*//////////////////////////////////////////////////////////////
                           CLAIM FAILURES
  //////////////////////////////////////////////////////////////*/

  describe("Claim failures", function () {
    it("rejects an invalid Merkle proof", async function () {
      const ctx = await createFundedClaimableCampaign({ includeOtherLeaf: true });
      const badProof = [
        keccak256(encodePacked(["string"], ["not-a-sibling"])),
      ] as Hex[];

      await viem.assertions.revertWithCustomError(
        ctx.distributor.write.claim(
          [ctx.campaignId, REWARD_ID, CLAIM_AMOUNT, badProof],
          { account: ctx.user.account },
        ),
        ctx.distributor,
        "InvalidProof",
      );
    });

    it("rejects an already claimed reward", async function () {
      const ctx = await createFundedClaimableCampaign();

      await ctx.distributor.write.claim(
        [ctx.campaignId, REWARD_ID, CLAIM_AMOUNT, ctx.userProof],
        { account: ctx.user.account },
      );

      const claimId = await ctx.distributor.read.getClaimId([
        ctx.campaignId,
        ctx.userAddress,
        REWARD_ID,
      ]);

      await viem.assertions.revertWithCustomErrorWithArgs(
        ctx.distributor.write.claim(
          [ctx.campaignId, REWARD_ID, CLAIM_AMOUNT, ctx.userProof],
          { account: ctx.user.account },
        ),
        ctx.distributor,
        "AlreadyClaimed",
        [claimId],
      );
    });

    it("rejects claims against an inactive campaign", async function () {
      const ctx = await createFundedClaimableCampaign({ active: false });

      await viem.assertions.revertWithCustomError(
        ctx.distributor.write.claim(
          [ctx.campaignId, REWARD_ID, CLAIM_AMOUNT, ctx.userProof],
          { account: ctx.user.account },
        ),
        ctx.distributor,
        "CampaignInactive",
      );
    });

    it("rejects claims before start time", async function () {
      const now = BigInt(await networkHelpers.time.latest());
      const start = now + 10_000n;
      const ctx = await createFundedClaimableCampaign({
        startTime: start,
        endTime: start + 10_000n,
      });

      await viem.assertions.revertWithCustomError(
        ctx.distributor.write.claim(
          [ctx.campaignId, REWARD_ID, CLAIM_AMOUNT, ctx.userProof],
          { account: ctx.user.account },
        ),
        ctx.distributor,
        "CampaignNotStarted",
      );
    });

    it("rejects claims after end time", async function () {
      const now = BigInt(await networkHelpers.time.latest());
      const start = now > 100n ? now - 100n : 0n;
      const end = now + 50n;
      const ctx = await createFundedClaimableCampaign({
        startTime: start,
        endTime: end,
      });

      await networkHelpers.time.increaseTo(end + 1n);

      await viem.assertions.revertWithCustomError(
        ctx.distributor.write.claim(
          [ctx.campaignId, REWARD_ID, CLAIM_AMOUNT, ctx.userProof],
          { account: ctx.user.account },
        ),
        ctx.distributor,
        "CampaignEnded",
      );
    });

    it("rejects claims while paused", async function () {
      const ctx = await createFundedClaimableCampaign();

      await ctx.distributor.write.pause({ account: ctx.owner.account });

      await viem.assertions.revertWithCustomError(
        ctx.distributor.write.claim(
          [ctx.campaignId, REWARD_ID, CLAIM_AMOUNT, ctx.userProof],
          { account: ctx.user.account },
        ),
        ctx.distributor,
        "EnforcedPause",
      );
    });

    it("rejects claims when the distributor has insufficient BQR", async function () {
      const ctx = await createFundedClaimableCampaign({ fundAmount: 0n });

      // Contract does not preflight vault balance; SafeERC20/ERC20 reverts.
      await viem.assertions.revertWithCustomError(
        ctx.distributor.write.claim(
          [ctx.campaignId, REWARD_ID, CLAIM_AMOUNT, ctx.userProof],
          { account: ctx.user.account },
        ),
        ctx.token,
        "ERC20InsufficientBalance",
      );
    });
  });

  /*//////////////////////////////////////////////////////////////
                              WITHDRAW
  //////////////////////////////////////////////////////////////*/

  describe("Withdraw unused BQR", function () {
    const WITHDRAW_AMOUNT = parseEther("250");

    async function fundedPausedFixture() {
      const ctx = await networkHelpers.loadFixture(deployFixture);
      await ctx.token.write.mint([ctx.ownerAddress, FUND_AMOUNT], {
        account: ctx.owner.account,
      });
      await ctx.token.write.approve([ctx.distributor.address, FUND_AMOUNT], {
        account: ctx.owner.account,
      });
      await ctx.distributor.write.fund([FUND_AMOUNT], {
        account: ctx.owner.account,
      });
      await ctx.distributor.write.pause({ account: ctx.owner.account });
      return ctx;
    }

    it("lets the owner withdraw while paused", async function () {
      const { distributor, token, owner, userAddress } =
        await fundedPausedFixture();

      const distributorBefore = await token.read.balanceOf([
        distributor.address,
      ]);
      const recipientBefore = await token.read.balanceOf([userAddress]);

      await viem.assertions.emitWithArgs(
        distributor.write.withdrawUnusedBqr(
          [userAddress, WITHDRAW_AMOUNT],
          { account: owner.account },
        ),
        distributor,
        "BqrWithdrawn",
        [userAddress, WITHDRAW_AMOUNT],
      );

      assert.equal(
        await token.read.balanceOf([distributor.address]),
        distributorBefore - WITHDRAW_AMOUNT,
      );
      assert.equal(
        await token.read.balanceOf([userAddress]),
        recipientBefore + WITHDRAW_AMOUNT,
      );
      assert.equal(
        await distributor.read.tokenBalance(),
        FUND_AMOUNT - WITHDRAW_AMOUNT,
      );
    });

    it("reverts if the contract is not paused", async function () {
      const { distributor, owner, userAddress } =
        await networkHelpers.loadFixture(deployFixture);

      await viem.assertions.revertWithCustomError(
        distributor.write.withdrawUnusedBqr(
          [userAddress, WITHDRAW_AMOUNT],
          { account: owner.account },
        ),
        distributor,
        "ExpectedPause",
      );
    });

    it("reverts if the caller is not the owner", async function () {
      const { distributor, user, userAddress } = await fundedPausedFixture();

      await viem.assertions.revertWithCustomError(
        distributor.write.withdrawUnusedBqr(
          [userAddress, WITHDRAW_AMOUNT],
          { account: user.account },
        ),
        distributor,
        "OwnableUnauthorizedAccount",
      );
    });

    it("reverts for a zero recipient address", async function () {
      const { distributor, owner } = await fundedPausedFixture();

      await viem.assertions.revertWithCustomError(
        distributor.write.withdrawUnusedBqr([zeroAddress, WITHDRAW_AMOUNT], {
          account: owner.account,
        }),
        distributor,
        "ZeroAddress",
      );
    });

    it("reverts for a zero amount", async function () {
      const { distributor, owner, userAddress } = await fundedPausedFixture();

      await viem.assertions.revertWithCustomError(
        distributor.write.withdrawUnusedBqr([userAddress, 0n], {
          account: owner.account,
        }),
        distributor,
        "InvalidAmount",
      );
    });
  });
});
