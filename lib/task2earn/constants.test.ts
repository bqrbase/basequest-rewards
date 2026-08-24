import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterMarketplaceTasks,
  isTask2EarnTestTask,
  resolveShowTestTasksInMarketplace,
  resolveTestSeedEnabled,
  T2E_TEST_TASK_TITLE,
} from "./constants.ts";

describe("test task marketplace isolation", () => {
  it("recognizes the TEST title prefix", () => {
    assert.equal(isTask2EarnTestTask({ title: T2E_TEST_TASK_TITLE }), true);
    assert.equal(isTask2EarnTestTask({ title: "Follow BaseQuest" }), false);
  });

  it("hides test tasks from the marketplace unless enabled", () => {
    const tasks = [
      { title: "Live campaign" },
      { title: T2E_TEST_TASK_TITLE },
    ];
    const hidden = filterMarketplaceTasks(tasks, false);
    assert.equal(hidden.length, 1);
    assert.equal(hidden[0]?.title, "Live campaign");

    const shown = filterMarketplaceTasks(tasks, true);
    assert.equal(shown.length, 2);
  });

  it("never enables test marketplace listing or seed in production", () => {
    assert.equal(
      resolveShowTestTasksInMarketplace({ envEnabled: true, production: true }),
      false,
    );
    assert.equal(
      resolveTestSeedEnabled({ envEnabled: true, production: true }),
      false,
    );
    assert.equal(
      resolveShowTestTasksInMarketplace({
        envEnabled: true,
        production: false,
      }),
      true,
    );
  });
});
