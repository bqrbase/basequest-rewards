import {
  assertRewardsAdmin,
  RewardsAdminAuthError,
} from "@/lib/rewards/server/adminAuth";
import {
  isTestSeedEnabled,
  T2E_TEST_TASK_TITLE,
} from "@/lib/task2earn/constants";
import {
  findExistingTestTask,
  seedOpenUnfundedTestTask,
} from "@/lib/task2earn/test-seed";
import { NextResponse } from "next/server";

/**
 * GET  /api/tasks/dev/seed-test — inspect the test task (does not create it)
 * POST /api/tasks/dev/seed-test — idempotent unfunded open Follow task
 *
 * Auth: Authorization: Bearer <REWARDS_ADMIN_SECRET>
 *       or x-rewards-admin-secret
 * Gate: T2E_ALLOW_TEST_SEED=true
 *
 * Off-chain only. No tokens, escrow, claims, or payouts.
 */
function seedDisabled() {
  return NextResponse.json(
    {
      success: false,
      error: "seed_disabled",
      notice:
        "Set T2E_ALLOW_TEST_SEED=true to enable this development seed. It is never created automatically.",
    },
    { status: 403 },
  );
}

function adminError(error: unknown) {
  if (error instanceof RewardsAdminAuthError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status },
    );
  }
  const message = error instanceof Error ? error.message : "seed_failed";
  if (message === "task2earn_unavailable") {
    return NextResponse.json(
      { success: false, error: "unavailable" },
      { status: 503 },
    );
  }
  console.error("[api/tasks/dev/seed-test]", error);
  return NextResponse.json(
    { success: false, error: "seed_failed" },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    if (!isTestSeedEnabled()) {
      return seedDisabled();
    }
    assertRewardsAdmin(request);
    const task = await findExistingTestTask();
    return NextResponse.json({
      success: true,
      exists: Boolean(task),
      task,
      title: T2E_TEST_TASK_TITLE,
      createdAutomatically: false,
    });
  } catch (error) {
    return adminError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isTestSeedEnabled()) {
      return seedDisabled();
    }
    assertRewardsAdmin(request);

    let body: { username?: string } = {};
    try {
      body = (await request.json()) as { username?: string };
    } catch {
      body = {};
    }

    const result = await seedOpenUnfundedTestTask({
      username: body.username,
    });
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({
      success: true,
      created: result.created,
      task: result.task,
      followUsername: result.followUsername,
      funded: false,
      payoutsCreated: false,
      claimsCreated: false,
      notice: result.notice,
    });
  } catch (error) {
    return adminError(error);
  }
}
