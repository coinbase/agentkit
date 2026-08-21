import { taskmarketActionProvider } from "./taskmarketActionProvider";

/**
 * Live end-to-end verification against the public TaskMarket API.
 * Gated: only runs when TASKMARKET_E2E=1 is set, so CI stays hermetic.
 */
const describeE2e = process.env.TASKMARKET_E2E ? describe : describe.skip;

describeE2e("TaskMarketActionProvider live e2e (read-only)", () => {
  it("fetches real open tasks from api.taskmarket.dev", async () => {
    const provider = taskmarketActionProvider();
    const out = await provider.fetchOpenTasks({ limit: 3, minReward: 1000000 });
    const parsed = JSON.parse(out);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });

  it("fetches the open integration task by id", async () => {
    const provider = taskmarketActionProvider();
    const out = await provider.getTask({
      taskId: "0x8e416ba0f3e473d2dddc7f7afc03ca35ab12b95972818808e9eff0d1e98e31fb",
    });
    expect(out).toContain("TaskMarket");
  });
});
