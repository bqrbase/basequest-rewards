import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import {
  encodePacked,
  getAddress,
  keccak256,
  parseEther,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";

import {
  assertDeployConstructorArgs,
  assertFundPoolGuards,
  BASE_MAINNET_CHAIN_ID,
  BQR_TOKEN,
  POOL_INITIAL_OWNER,
  REWARDS_DISTRIBUTOR_ADDRESS,
  SHARE_REWARD_AMOUNT,
} from "../scripts/lib/bqrShareRewardsPoolGuards.js";

const REWARD_AMOUNT = parseEther("25");
const FUND_10K = parseEther("10000");
const COOLDOWN_SECONDS = 24 * 60 * 60;

describe("BqrShareRewardsPool", async function () {
  const { viem, networkHelpers } = await network.create();

  async function deployFixture() {
    const [owner, user, other] = await viem.getWalletClients();
    const token = await viem.deployContract("MockERC20");
    const pool = await viem.deployContract("BqrShareRewardsPool", [
      owner.account.address,
      token.address,
    ]);

    return {
      owner,
      user,
      other,
      token,
      pool,
      ownerAddress: owner.account.address as Address,
      userAddress: user.account.address as Address,
      otherAddress: other.account.address as Address,
    };
  }

  async function fundedFixture(fundAmount: bigint = FUND_10K) {
    const ctx = await networkHelpers.loadFixture(deployFixture);
    if (fundAmount > 0n) {
      await ctx.token.write.mint([ctx.ownerAddress, fundAmount], {
        account: ctx.owner.account,
      });
      await ctx.token.write.approve([ctx.pool.address, fundAmount], {
        account: ctx.owner.account,
      });
      await ctx.pool.write.fund([fundAmount], {
        account: ctx.owner.account,
      });
    }
    return ctx;
  }

  function castHashFor(label: string): Hex {
    return keccak256(encodePacked(["string"], [label]));
  }

  /*//////////////////////////////////////////////////////////////
                              DEPLOYMENT
  //////////////////////////////////////////////////////////////*/

  describe("Deployment", function () {
    it("constructor stores token and 25e18 rewardAmount", async function () {
      const { token, pool } = await networkHelpers.loadFixture(deployFixture);
      assert.equal(
        (await pool.read.bqrToken()).toLowerCase(),
        token.address.toLowerCase(),
      );
      assert.equal(await pool.read.rewardAmount(), REWARD_AMOUNT);
    });

    it("constructor rejects zero token", async function () {
      const [owner] = await viem.getWalletClients();
      await assert.rejects(() =>
        viem.deployContract("BqrShareRewardsPool", [
          owner.account.address,
          zeroAddress,
        ]),
      );
    });
  });

  /*//////////////////////////////////////////////////////////////
                               FUNDING
  //////////////////////////////////////////////////////////////*/

  describe("Funding", function () {
    it("fund transfers tokens into pool", async function () {
      const { token, pool, owner, ownerAddress } =
        await networkHelpers.loadFixture(deployFixture);

      await token.write.mint([ownerAddress, FUND_10K], {
        account: owner.account,
      });
      await token.write.approve([pool.address, FUND_10K], {
        account: owner.account,
      });

      await viem.assertions.emitWithArgs(
        pool.write.fund([FUND_10K], { account: owner.account }),
        pool,
        "Funded",
        [ownerAddress, FUND_10K],
      );

      assert.equal(await pool.read.tokenBalance(), FUND_10K);
    });

    it("repeated fund() works", async function () {
      const ctx = await fundedFixture(FUND_10K);
      const extra = parseEther("5000");
      await ctx.token.write.mint([ctx.ownerAddress, extra], {
        account: ctx.owner.account,
      });
      await ctx.token.write.approve([ctx.pool.address, extra], {
        account: ctx.owner.account,
      });
      await ctx.pool.write.fund([extra], { account: ctx.owner.account });
      assert.equal(await ctx.pool.read.tokenBalance(), FUND_10K + extra);
    });

    it("only owner can fund", async function () {
      const { pool, user, token, userAddress } =
        await networkHelpers.loadFixture(deployFixture);
      await token.write.mint([userAddress, REWARD_AMOUNT], {
        account: user.account,
      });
      await token.write.approve([pool.address, REWARD_AMOUNT], {
        account: user.account,
      });
      await viem.assertions.revertWithCustomError(
        pool.write.fund([REWARD_AMOUNT], { account: user.account }),
        pool,
        "OwnableUnauthorizedAccount",
      );
    });

    it("funding remains possible while paused", async function () {
      const { pool, owner, token, ownerAddress } =
        await networkHelpers.loadFixture(deployFixture);
      await pool.write.pause({ account: owner.account });
      await token.write.mint([ownerAddress, FUND_10K], {
        account: owner.account,
      });
      await token.write.approve([pool.address, FUND_10K], {
        account: owner.account,
      });
      await pool.write.fund([FUND_10K], { account: owner.account });
      assert.equal(await pool.read.tokenBalance(), FUND_10K);
    });
  });

  /*//////////////////////////////////////////////////////////////
                                CLAIM
  //////////////////////////////////////////////////////////////*/

  describe("Claim", function () {
    it("verified user can claim exactly 25 BQR to msg.sender", async function () {
      const ctx = await fundedFixture();
      const fid = 368591n;
      const castHash = castHashFor("valid-share");
      const claimId = await ctx.pool.read.getClaimId([
        ctx.userAddress,
        fid,
        castHash,
      ]);
      const before = await ctx.token.read.balanceOf([ctx.userAddress]);
      const ownerBefore = await ctx.token.read.balanceOf([ctx.ownerAddress]);

      await viem.assertions.emitWithArgs(
        ctx.pool.write.claim([fid, castHash], { account: ctx.user.account }),
        ctx.pool,
        "ShareRewardClaimed",
        [ctx.userAddress, fid, claimId, castHash, REWARD_AMOUNT],
      );

      assert.equal(
        (await ctx.token.read.balanceOf([ctx.userAddress])) - before,
        REWARD_AMOUNT,
      );
      assert.equal(await ctx.token.read.balanceOf([ctx.ownerAddress]), ownerBefore);
      assert.equal(await ctx.pool.read.totalPaid(), REWARD_AMOUNT);
      assert.equal(await ctx.pool.read.tokenBalance(), FUND_10K - REWARD_AMOUNT);
      assert.equal(await ctx.pool.read.isClaimIdUsed([claimId]), true);
    });

    it("payout always goes to msg.sender, never the owner", async function () {
      const ctx = await fundedFixture();
      const ownerBefore = await ctx.token.read.balanceOf([ctx.ownerAddress]);
      const otherBefore = await ctx.token.read.balanceOf([ctx.otherAddress]);
      await ctx.pool.write.claim([2n, castHashFor("msg-sender")], {
        account: ctx.other.account,
      });
      assert.equal(
        (await ctx.token.read.balanceOf([ctx.otherAddress])) - otherBefore,
        REWARD_AMOUNT,
      );
      assert.equal(await ctx.token.read.balanceOf([ctx.ownerAddress]), ownerBefore);
      assert.equal(await ctx.token.read.balanceOf([ctx.userAddress]), 0n);
    });

    it("cannot pay more than 25 BQR per successful claim", async function () {
      const ctx = await fundedFixture();
      assert.equal(await ctx.pool.read.rewardAmount(), REWARD_AMOUNT);
      await ctx.pool.write.claim([1n, castHashFor("fixed-amount")], {
        account: ctx.user.account,
      });
      assert.equal(await ctx.pool.read.totalPaid(), REWARD_AMOUNT);
      assert.equal(
        await ctx.token.read.balanceOf([ctx.userAddress]),
        REWARD_AMOUNT,
      );
    });

    /**
     * TEST-ONLY limitation: Neynar eligibility is application-side.
     * The contract does not know whether Verify ran. A wallet that never
     * shared can still call claim(fid, castHash) directly and receive 25 BQR.
     */
    it("TEST-ONLY: unverified wallet calling the contract directly is NOT protected by Neynar", async function () {
      const ctx = await fundedFixture();
      await ctx.pool.write.claim([99n, castHashFor("never-verified")], {
        account: ctx.user.account,
      });
      assert.equal(
        await ctx.token.read.balanceOf([ctx.userAddress]),
        REWARD_AMOUNT,
      );
    });

    it("same claim cannot be replayed", async function () {
      const ctx = await fundedFixture();
      const fid = 3n;
      const castHash = castHashFor("replay");
      await ctx.pool.write.claim([fid, castHash], { account: ctx.user.account });
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.claim([fid, castHash], { account: ctx.user.account }),
        ctx.pool,
        "ClaimAlreadyUsed",
      );
    });

    it("same claim cannot be replayed after 24h", async function () {
      const ctx = await fundedFixture();
      const fid = 4n;
      const castHash = castHashFor("replay-after-cooldown");
      const claimId = await ctx.pool.read.getClaimId([
        ctx.userAddress,
        fid,
        castHash,
      ]);
      await ctx.pool.write.claim([fid, castHash], { account: ctx.user.account });
      await networkHelpers.time.increase(COOLDOWN_SECONDS + 1);
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.claim([fid, castHash], { account: ctx.user.account }),
        ctx.pool,
        "ClaimAlreadyUsed",
      );
      assert.equal(await ctx.pool.read.isClaimIdUsed([claimId]), true);
    });

    it("same FID cannot claim again within 24 hours", async function () {
      const ctx = await fundedFixture();
      const fid = 5n;
      await ctx.pool.write.claim([fid, castHashFor("fid-5-a")], {
        account: ctx.user.account,
      });
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.claim([fid, castHashFor("fid-5-b")], {
          account: ctx.user.account,
        }),
        ctx.pool,
        "FidCooldown",
      );
    });

    it("same FID using another wallet is still blocked", async function () {
      const ctx = await fundedFixture();
      const fid = 6n;
      await ctx.pool.write.claim([fid, castHashFor("fid-6-user")], {
        account: ctx.user.account,
      });
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.claim([fid, castHashFor("fid-6-other")], {
          account: ctx.other.account,
        }),
        ctx.pool,
        "FidCooldown",
      );
    });

    it("claim succeeds after 24 hours with a new Share", async function () {
      const ctx = await fundedFixture();
      const fid = 7n;
      await ctx.pool.write.claim([fid, castHashFor("fid-7-a")], {
        account: ctx.user.account,
      });
      await networkHelpers.time.increase(COOLDOWN_SECONDS + 1);
      await ctx.pool.write.claim([fid, castHashFor("fid-7-b")], {
        account: ctx.user.account,
      });
      assert.equal(await ctx.pool.read.totalPaid(), REWARD_AMOUNT * 2n);
    });

    it("insufficient pool balance reverts", async function () {
      const ctx = await fundedFixture(0n);
      const fid = 8n;
      const castHash = castHashFor("empty-pool");
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.claim([fid, castHash], { account: ctx.user.account }),
        ctx.pool,
        "InsufficientPoolBalance",
      );
    });

    it("funding does not affect the 24h cooldown", async function () {
      const ctx = await fundedFixture(REWARD_AMOUNT * 2n);
      const fid = 9n;
      await ctx.pool.write.claim([fid, castHashFor("cool-a")], {
        account: ctx.user.account,
      });
      await ctx.token.write.mint([ctx.ownerAddress, FUND_10K], {
        account: ctx.owner.account,
      });
      await ctx.token.write.approve([ctx.pool.address, FUND_10K], {
        account: ctx.owner.account,
      });
      await ctx.pool.write.fund([FUND_10K], { account: ctx.owner.account });
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.claim([fid, castHashFor("cool-b")], {
          account: ctx.user.account,
        }),
        ctx.pool,
        "FidCooldown",
      );
    });

    it("pause blocks claims", async function () {
      const ctx = await fundedFixture();
      const fid = 10n;
      const castHash = castHashFor("paused");
      await ctx.pool.write.pause({ account: ctx.owner.account });
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.claim([fid, castHash], { account: ctx.user.account }),
        ctx.pool,
        "EnforcedPause",
      );
    });

    it("claim works again after unpause", async function () {
      const ctx = await fundedFixture();
      const fid = 11n;
      const castHash = castHashFor("unpause");
      await ctx.pool.write.pause({ account: ctx.owner.account });
      await ctx.pool.write.unpause({ account: ctx.owner.account });
      await ctx.pool.write.claim([fid, castHash], { account: ctx.user.account });
      assert.equal(await ctx.pool.read.totalPaid(), REWARD_AMOUNT);
    });

    it("has no qualifyShare function", async function () {
      const ctx = await fundedFixture();
      assert.equal(
        "qualifyShare" in ctx.pool.write,
        false,
        "TEST-ONLY pool must not expose qualifyShare",
      );
    });
  });

  /*//////////////////////////////////////////////////////////////
                              WITHDRAW
  //////////////////////////////////////////////////////////////*/

  describe("Withdraw unused BQR", function () {
    it("emergency withdrawal only works while paused", async function () {
      const ctx = await fundedFixture();
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.withdrawUnusedBqr(
          [ctx.ownerAddress, REWARD_AMOUNT],
          { account: ctx.owner.account },
        ),
        ctx.pool,
        "ExpectedPause",
      );

      await ctx.pool.write.pause({ account: ctx.owner.account });
      await viem.assertions.emitWithArgs(
        ctx.pool.write.withdrawUnusedBqr(
          [ctx.ownerAddress, REWARD_AMOUNT],
          { account: ctx.owner.account },
        ),
        ctx.pool,
        "BqrWithdrawn",
        [ctx.ownerAddress, REWARD_AMOUNT],
      );
    });
  });

  /*//////////////////////////////////////////////////////////////
                         NO LIFETIME CAP
  //////////////////////////////////////////////////////////////*/

  describe("No lifetime cap", function () {
    it("fund 10,000, claim, fund another 10,000, claims continue", async function () {
      const ctx = await fundedFixture(FUND_10K);
      await ctx.pool.write.claim([20n, castHashFor("cycle-1")], {
        account: ctx.user.account,
      });

      await ctx.token.write.mint([ctx.ownerAddress, FUND_10K], {
        account: ctx.owner.account,
      });
      await ctx.token.write.approve([ctx.pool.address, FUND_10K], {
        account: ctx.owner.account,
      });
      await ctx.pool.write.fund([FUND_10K], { account: ctx.owner.account });

      await ctx.pool.write.claim([21n, castHashFor("cycle-2")], {
        account: ctx.other.account,
      });
      assert.equal(await ctx.pool.read.totalPaid(), REWARD_AMOUNT * 2n);
      assert.equal(
        await ctx.pool.read.tokenBalance(),
        FUND_10K * 2n - REWARD_AMOUNT * 2n,
      );
    });
  });

  /*//////////////////////////////////////////////////////////////
                           SCRIPT GUARDS
  //////////////////////////////////////////////////////////////*/

  describe("script guards", function () {
    const funder = getAddress(
      "0x1819171c76D4B993ae6f14f43381b1Dfcd2AA09f",
    );
    const pool = getAddress("0x1111111111111111111111111111111111111111");

    it("fund guard rejects RewardsDistributor address", function () {
      assert.throws(
        () =>
          assertFundPoolGuards({
            chainId: BASE_MAINNET_CHAIN_ID,
            poolAddress: REWARDS_DISTRIBUTOR_ADDRESS,
            deployer: funder,
            owner: funder,
            bqrToken: BQR_TOKEN,
            rewardAmount: SHARE_REWARD_AMOUNT,
          }),
        /RewardsDistributor/,
      );
    });

    it("fund guard rejects wrong rewardAmount", function () {
      assert.throws(
        () =>
          assertFundPoolGuards({
            chainId: BASE_MAINNET_CHAIN_ID,
            poolAddress: pool,
            deployer: funder,
            owner: funder,
            bqrToken: BQR_TOKEN,
            rewardAmount: parseEther("24"),
          }),
        /rewardAmount/,
      );
    });

    it("deploy guard rejects zero owner", function () {
      assert.throws(
        () =>
          assertDeployConstructorArgs({
            chainId: BASE_MAINNET_CHAIN_ID,
            initialOwner: zeroAddress,
            bqrToken: BQR_TOKEN,
          }),
        /initialOwner must be/,
      );
    });

    it("deploy guard rejects the project deployer as owner", function () {
      assert.throws(
        () =>
          assertDeployConstructorArgs({
            chainId: BASE_MAINNET_CHAIN_ID,
            initialOwner: funder,
            bqrToken: BQR_TOKEN,
          }),
        /initialOwner must be/,
      );
    });

    it("deploy guard accepts the pinned pool owner", function () {
      assert.doesNotThrow(() =>
        assertDeployConstructorArgs({
          chainId: BASE_MAINNET_CHAIN_ID,
          initialOwner: POOL_INITIAL_OWNER,
          bqrToken: BQR_TOKEN,
        }),
      );
    });

    it("accepts a valid fund snapshot that is not RewardsDistributor", function () {
      assert.doesNotThrow(() =>
        assertFundPoolGuards({
          chainId: BASE_MAINNET_CHAIN_ID,
          poolAddress: pool,
          deployer: funder,
          owner: funder,
          bqrToken: BQR_TOKEN,
          rewardAmount: SHARE_REWARD_AMOUNT,
        }),
      );
    });
  });
});
