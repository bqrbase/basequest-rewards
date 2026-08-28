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
  assertNotExistingSharePool,
  assertProductionDeployConstructorArgs,
  BASE_MAINNET_CHAIN_ID,
  HARDHAT_DEPLOYER,
  OLD_LIVE_SHARE_POOL,
  PRODUCTION_BQR_TOKEN,
  PRODUCTION_POOL_OPERATOR,
  PRODUCTION_POOL_OWNER,
  PRODUCTION_REWARD_AMOUNT,
  TEST_ONLY_SHARE_POOL,
} from "../scripts/lib/bqrShareRewardsPoolProductionGuards.js";

const REWARD_AMOUNT = parseEther("25");
const FUND_10K = parseEther("10000");
const COOLDOWN_SECONDS = 24 * 60 * 60;

describe("BqrShareRewardsPoolProduction", async function () {
  const { viem, networkHelpers } = await network.create();

  async function deployFixture() {
    const [owner, operator, user, other, random] = await viem.getWalletClients();
    const token = await viem.deployContract("MockERC20");
    const pool = await viem.deployContract("BqrShareRewardsPoolProduction", [
      owner.account.address,
      operator.account.address,
      token.address,
    ]);

    return {
      owner,
      operator,
      user,
      other,
      random,
      token,
      pool,
      ownerAddress: owner.account.address as Address,
      operatorAddress: operator.account.address as Address,
      userAddress: user.account.address as Address,
      otherAddress: other.account.address as Address,
      randomAddress: random.account.address as Address,
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

  async function authorizedClaim(
    ctx: Awaited<ReturnType<typeof fundedFixture>>,
    account: Address,
    fid: bigint,
    castHash: Hex,
  ) {
    await ctx.pool.write.authorize([account, fid, castHash], {
      account: ctx.operator.account,
    });
  }

  function castHashFor(label: string): Hex {
    return keccak256(encodePacked(["string"], [label]));
  }

  describe("Deployment", function () {
    it("1. sets the constructor owner", async function () {
      const { pool, ownerAddress } = await networkHelpers.loadFixture(deployFixture);
      assert.equal(
        getAddress(await pool.read.owner()),
        getAddress(ownerAddress),
      );
    });

    it("2. sets the constructor operator", async function () {
      const { pool, operatorAddress } =
        await networkHelpers.loadFixture(deployFixture);
      assert.equal(
        getAddress(await pool.read.operator()),
        getAddress(operatorAddress),
      );
    });

    it("3. sets the BQR token", async function () {
      const { pool, token } = await networkHelpers.loadFixture(deployFixture);
      assert.equal(
        getAddress(await pool.read.bqrToken()),
        getAddress(token.address),
      );
    });

    it("4. reward amount is exactly 25e18", async function () {
      const { pool } = await networkHelpers.loadFixture(deployFixture);
      assert.equal(await pool.read.rewardAmount(), REWARD_AMOUNT);
      assert.equal(REWARD_AMOUNT, PRODUCTION_REWARD_AMOUNT);
    });

    it("rejects zero operator and zero token", async function () {
      const [owner, operator] = await viem.getWalletClients();
      const token = await viem.deployContract("MockERC20");
      await assert.rejects(() =>
        viem.deployContract("BqrShareRewardsPoolProduction", [
          owner.account.address,
          zeroAddress,
          token.address,
        ]),
      );
      await assert.rejects(() =>
        viem.deployContract("BqrShareRewardsPoolProduction", [
          owner.account.address,
          operator.account.address,
          zeroAddress,
        ]),
      );
    });
  });

  describe("Authorize", function () {
    it("5. operator can authorize a valid claim", async function () {
      const ctx = await fundedFixture();
      const fid = 11n;
      const castHash = castHashFor("auth-ok");
      const claimId = await ctx.pool.read.getClaimId([
        ctx.userAddress,
        fid,
        castHash,
      ]);
      await viem.assertions.emitWithArgs(
        ctx.pool.write.authorize([ctx.userAddress, fid, castHash], {
          account: ctx.operator.account,
        }),
        ctx.pool,
        "ShareAuthorized",
        [ctx.userAddress, fid, castHash, claimId],
      );
      assert.equal(await ctx.pool.read.isAuthorized([claimId]), true);
      assert.equal(await ctx.pool.read.isClaimIdUsed([claimId]), false);
    });

    it("6. random address cannot authorize", async function () {
      const ctx = await fundedFixture();
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.authorize(
          [ctx.userAddress, 12n, castHashFor("random-auth")],
          { account: ctx.random.account },
        ),
        ctx.pool,
        "NotOperator",
      );
    });

    it("29. authorization is bound to (account, fid, castHash)", async function () {
      const ctx = await fundedFixture();
      const fid = 13n;
      const castHash = castHashFor("bound");
      await authorizedClaim(ctx, ctx.userAddress, fid, castHash);
      const userId = await ctx.pool.read.getClaimId([
        ctx.userAddress,
        fid,
        castHash,
      ]);
      const otherWallet = await ctx.pool.read.getClaimId([
        ctx.otherAddress,
        fid,
        castHash,
      ]);
      const otherFid = await ctx.pool.read.getClaimId([
        ctx.userAddress,
        fid + 1n,
        castHash,
      ]);
      const otherCast = await ctx.pool.read.getClaimId([
        ctx.userAddress,
        fid,
        castHashFor("bound-other"),
      ]);
      assert.notEqual(userId, otherWallet);
      assert.notEqual(userId, otherFid);
      assert.notEqual(userId, otherCast);
      assert.equal(await ctx.pool.read.isAuthorized([userId]), true);
      assert.equal(await ctx.pool.read.isAuthorized([otherWallet]), false);
    });

    it("30. a used authorization cannot be overwritten or reused", async function () {
      const ctx = await fundedFixture();
      const fid = 14n;
      const castHash = castHashFor("no-overwrite");
      await authorizedClaim(ctx, ctx.userAddress, fid, castHash);
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.authorize([ctx.userAddress, fid, castHash], {
          account: ctx.operator.account,
        }),
        ctx.pool,
        "AlreadyAuthorized",
      );
      await ctx.pool.write.claim([fid, castHash], { account: ctx.user.account });
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.authorize([ctx.userAddress, fid, castHash], {
          account: ctx.operator.account,
        }),
        ctx.pool,
        "ClaimAlreadyUsed",
      );
    });
  });

  describe("Operator cannot administer the pool", function () {
    it("7. operator cannot withdraw BQR", async function () {
      const ctx = await fundedFixture();
      await ctx.pool.write.pause({ account: ctx.owner.account });
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.withdrawUnusedBqr([REWARD_AMOUNT, ctx.operatorAddress], {
          account: ctx.operator.account,
        }),
        ctx.pool,
        "OwnableUnauthorizedAccount",
      );
    });

    it("8. operator cannot pause", async function () {
      const ctx = await fundedFixture();
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.pause({ account: ctx.operator.account }),
        ctx.pool,
        "OwnableUnauthorizedAccount",
      );
    });

    it("9. operator cannot unpause", async function () {
      const ctx = await fundedFixture();
      await ctx.pool.write.pause({ account: ctx.owner.account });
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.unpause({ account: ctx.operator.account }),
        ctx.pool,
        "OwnableUnauthorizedAccount",
      );
    });

    it("10. operator cannot change owner", async function () {
      const ctx = await fundedFixture();
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.transferOwnership([ctx.operatorAddress], {
          account: ctx.operator.account,
        }),
        ctx.pool,
        "OwnableUnauthorizedAccount",
      );
      assert.equal(
        getAddress(await ctx.pool.read.owner()),
        getAddress(ctx.ownerAddress),
      );
    });
  });

  describe("Claim", function () {
    it("11. user cannot claim without authorization", async function () {
      const ctx = await fundedFixture();
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.claim([15n, castHashFor("no-auth")], {
          account: ctx.user.account,
        }),
        ctx.pool,
        "NotAuthorized",
      );
    });

    it("12. user cannot modify the recipient", async function () {
      const ctx = await fundedFixture();
      const fid = 16n;
      const castHash = castHashFor("no-recipient-arg");
      await authorizedClaim(ctx, ctx.userAddress, fid, castHash);
      const ownerBefore = await ctx.token.read.balanceOf([ctx.ownerAddress]);
      const otherBefore = await ctx.token.read.balanceOf([ctx.otherAddress]);
      await ctx.pool.write.claim([fid, castHash], { account: ctx.user.account });
      assert.equal(
        await ctx.token.read.balanceOf([ctx.userAddress]),
        REWARD_AMOUNT,
      );
      assert.equal(await ctx.token.read.balanceOf([ctx.ownerAddress]), ownerBefore);
      assert.equal(await ctx.token.read.balanceOf([ctx.otherAddress]), otherBefore);
    });

    it("13. user cannot use another wallet's authorization", async function () {
      const ctx = await fundedFixture();
      const fid = 17n;
      const castHash = castHashFor("other-wallet");
      await authorizedClaim(ctx, ctx.userAddress, fid, castHash);
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.claim([fid, castHash], { account: ctx.other.account }),
        ctx.pool,
        "NotAuthorized",
      );
      assert.equal(await ctx.token.read.balanceOf([ctx.otherAddress]), 0n);
    });

    it("14+15. user receives exactly 25 BQR and pool decreases by 25 BQR", async function () {
      const ctx = await fundedFixture();
      const fid = 18n;
      const castHash = castHashFor("payout");
      const claimId = await ctx.pool.read.getClaimId([
        ctx.userAddress,
        fid,
        castHash,
      ]);
      await authorizedClaim(ctx, ctx.userAddress, fid, castHash);
      const userBefore = await ctx.token.read.balanceOf([ctx.userAddress]);
      const poolBefore = await ctx.pool.read.tokenBalance();

      await viem.assertions.emitWithArgs(
        ctx.pool.write.claim([fid, castHash], { account: ctx.user.account }),
        ctx.pool,
        "ShareRewardClaimed",
        [ctx.userAddress, fid, claimId, castHash, REWARD_AMOUNT],
      );

      assert.equal(
        (await ctx.token.read.balanceOf([ctx.userAddress])) - userBefore,
        REWARD_AMOUNT,
      );
      assert.equal(await ctx.pool.read.tokenBalance(), poolBefore - REWARD_AMOUNT);
      assert.equal(await ctx.pool.read.totalPaid(), REWARD_AMOUNT);
      assert.equal(await ctx.pool.read.isClaimIdUsed([claimId]), true);
      assert.equal(await ctx.pool.read.isAuthorized([claimId]), false);
    });

    it("16. same claim cannot be claimed twice", async function () {
      const ctx = await fundedFixture();
      const fid = 19n;
      const castHash = castHashFor("replay");
      await authorizedClaim(ctx, ctx.userAddress, fid, castHash);
      await ctx.pool.write.claim([fid, castHash], { account: ctx.user.account });
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.claim([fid, castHash], { account: ctx.user.account }),
        ctx.pool,
        "ClaimAlreadyUsed",
      );
    });

    it("17. same FID cannot claim again within 24 hours", async function () {
      const ctx = await fundedFixture();
      const fid = 20n;
      await authorizedClaim(ctx, ctx.userAddress, fid, castHashFor("fid-a"));
      await ctx.pool.write.claim([fid, castHashFor("fid-a")], {
        account: ctx.user.account,
      });
      await authorizedClaim(ctx, ctx.userAddress, fid, castHashFor("fid-b"));
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.claim([fid, castHashFor("fid-b")], {
          account: ctx.user.account,
        }),
        ctx.pool,
        "FidCooldown",
      );
    });

    it("18. same FID can claim again after 24 hours", async function () {
      const ctx = await fundedFixture();
      const fid = 21n;
      await authorizedClaim(ctx, ctx.userAddress, fid, castHashFor("after-a"));
      await ctx.pool.write.claim([fid, castHashFor("after-a")], {
        account: ctx.user.account,
      });
      await networkHelpers.time.increase(COOLDOWN_SECONDS + 1);
      await authorizedClaim(ctx, ctx.userAddress, fid, castHashFor("after-b"));
      await ctx.pool.write.claim([fid, castHashFor("after-b")], {
        account: ctx.user.account,
      });
      assert.equal(await ctx.pool.read.totalPaid(), REWARD_AMOUNT * 2n);
    });

    it("19. different FIDs can claim independently", async function () {
      const ctx = await fundedFixture();
      await authorizedClaim(ctx, ctx.userAddress, 22n, castHashFor("fid-22"));
      await authorizedClaim(ctx, ctx.otherAddress, 23n, castHashFor("fid-23"));
      await ctx.pool.write.claim([22n, castHashFor("fid-22")], {
        account: ctx.user.account,
      });
      await ctx.pool.write.claim([23n, castHashFor("fid-23")], {
        account: ctx.other.account,
      });
      assert.equal(await ctx.token.read.balanceOf([ctx.userAddress]), REWARD_AMOUNT);
      assert.equal(await ctx.token.read.balanceOf([ctx.otherAddress]), REWARD_AMOUNT);
    });

    it("20. claim reverts while paused", async function () {
      const ctx = await fundedFixture();
      const fid = 24n;
      const castHash = castHashFor("paused-claim");
      await authorizedClaim(ctx, ctx.userAddress, fid, castHash);
      await ctx.pool.write.pause({ account: ctx.owner.account });
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.claim([fid, castHash], { account: ctx.user.account }),
        ctx.pool,
        "EnforcedPause",
      );
    });

    it("21. authorization reverts while paused", async function () {
      const ctx = await fundedFixture();
      await ctx.pool.write.pause({ account: ctx.owner.account });
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.authorize(
          [ctx.userAddress, 25n, castHashFor("paused-auth")],
          { account: ctx.operator.account },
        ),
        ctx.pool,
        "EnforcedPause",
      );
    });

    it("22. claim reverts when pool has less than 25 BQR", async function () {
      const ctx = await fundedFixture(0n);
      const fid = 26n;
      const castHash = castHashFor("empty");
      await authorizedClaim(ctx, ctx.userAddress, fid, castHash);
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.claim([fid, castHash], { account: ctx.user.account }),
        ctx.pool,
        "InsufficientPoolBalance",
      );
    });
  });

  describe("Owner controls", function () {
    it("23. owner can fund the pool", async function () {
      const ctx = await networkHelpers.loadFixture(deployFixture);
      await ctx.token.write.mint([ctx.ownerAddress, FUND_10K], {
        account: ctx.owner.account,
      });
      await ctx.token.write.approve([ctx.pool.address, FUND_10K], {
        account: ctx.owner.account,
      });
      await viem.assertions.emitWithArgs(
        ctx.pool.write.fund([FUND_10K], { account: ctx.owner.account }),
        ctx.pool,
        "Funded",
        [ctx.ownerAddress, FUND_10K],
      );
      assert.equal(await ctx.pool.read.tokenBalance(), FUND_10K);
    });

    it("24. owner can pause", async function () {
      const ctx = await fundedFixture();
      await ctx.pool.write.pause({ account: ctx.owner.account });
      assert.equal(await ctx.pool.read.paused(), true);
    });

    it("25. owner can unpause", async function () {
      const ctx = await fundedFixture();
      await ctx.pool.write.pause({ account: ctx.owner.account });
      await ctx.pool.write.unpause({ account: ctx.owner.account });
      assert.equal(await ctx.pool.read.paused(), false);
    });

    it("26. owner can withdraw only while paused", async function () {
      const ctx = await fundedFixture();
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.withdrawUnusedBqr([REWARD_AMOUNT, ctx.ownerAddress], {
          account: ctx.owner.account,
        }),
        ctx.pool,
        "ExpectedPause",
      );
      await ctx.pool.write.pause({ account: ctx.owner.account });
      const before = await ctx.token.read.balanceOf([ctx.ownerAddress]);
      await viem.assertions.emitWithArgs(
        ctx.pool.write.withdrawUnusedBqr([REWARD_AMOUNT, ctx.ownerAddress], {
          account: ctx.owner.account,
        }),
        ctx.pool,
        "BqrWithdrawn",
        [ctx.ownerAddress, REWARD_AMOUNT],
      );
      assert.equal(
        (await ctx.token.read.balanceOf([ctx.ownerAddress])) - before,
        REWARD_AMOUNT,
      );
    });

    it("27. owner cannot withdraw more than the pool balance", async function () {
      const ctx = await fundedFixture(REWARD_AMOUNT);
      await ctx.pool.write.pause({ account: ctx.owner.account });
      await viem.assertions.revertWithCustomError(
        ctx.pool.write.withdrawUnusedBqr([REWARD_AMOUNT + 1n, ctx.ownerAddress], {
          account: ctx.owner.account,
        }),
        ctx.pool,
        "InsufficientPoolBalance",
      );
    });
  });

  describe("Reentrancy", function () {
    it("28. reentrancy protection remains active", async function () {
      const [owner, operator, user] = await viem.getWalletClients();
      const token = await viem.deployContract("ReentrantShareClaimToken");
      const pool = await viem.deployContract("BqrShareRewardsPoolProduction", [
        owner.account.address,
        operator.account.address,
        token.address,
      ]);
      const fid = 27n;
      const castHash = castHashFor("reenter");
      await token.write.mint([owner.account.address, FUND_10K]);
      await token.write.approve([pool.address, FUND_10K], {
        account: owner.account,
      });
      await pool.write.fund([FUND_10K], { account: owner.account });
      await pool.write.authorize([user.account.address, fid, castHash], {
        account: operator.account,
      });
      await token.write.arm([pool.address, fid, castHash]);
      await viem.assertions.revertWithCustomError(
        pool.write.claim([fid, castHash], { account: user.account }),
        pool,
        "ReentrancyGuardReentrantCall",
      );
    });
  });

  describe("production constructor guards", function () {
    it("pins treasury owner, dedicated operator, and BQR token", function () {
      assert.doesNotThrow(() =>
        assertProductionDeployConstructorArgs({
          chainId: BASE_MAINNET_CHAIN_ID,
          initialOwner: PRODUCTION_POOL_OWNER,
          operator: PRODUCTION_POOL_OPERATOR,
          bqrToken: PRODUCTION_BQR_TOKEN,
        }),
      );
    });

    it("rejects the Hardhat deployer as owner or operator", function () {
      assert.throws(
        () =>
          assertProductionDeployConstructorArgs({
            chainId: BASE_MAINNET_CHAIN_ID,
            initialOwner: HARDHAT_DEPLOYER,
            operator: PRODUCTION_POOL_OPERATOR,
            bqrToken: PRODUCTION_BQR_TOKEN,
          }),
        /initialOwner must be/,
      );
      assert.throws(
        () =>
          assertProductionDeployConstructorArgs({
            chainId: BASE_MAINNET_CHAIN_ID,
            initialOwner: PRODUCTION_POOL_OWNER,
            operator: HARDHAT_DEPLOYER,
            bqrToken: PRODUCTION_BQR_TOKEN,
          }),
        /operator must be/,
      );
    });

    it("refuses TEST-ONLY and old live pool addresses", function () {
      assert.throws(
        () => assertNotExistingSharePool(TEST_ONLY_SHARE_POOL),
        /TEST-ONLY/,
      );
      assert.throws(
        () => assertNotExistingSharePool(OLD_LIVE_SHARE_POOL),
        /old live/,
      );
    });
  });
});
