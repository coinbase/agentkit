import { Network } from "../../network";
import { TaskMarketActionProvider } from "./taskmarketActionProvider";

const taskId = `0x${"a".repeat(64)}`;

/**
 * Build a minimal Response without reaching the network.
 *
 * @param body - JSON response body.
 * @param status - HTTP status.
 * @returns A response fixture.
 */
function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("TaskMarketActionProvider", () => {
  it("exposes read-only discovery, inspection, and tracking actions", () => {
    const provider = new TaskMarketActionProvider({ fetch: jest.fn() });
    const actions = provider.getActions({} as never);

    expect(actions.map(action => action.name)).toEqual([
      "TaskMarketActionProvider_list_taskmarket_tasks",
      "TaskMarketActionProvider_get_taskmarket_task",
      "TaskMarketActionProvider_list_taskmarket_submissions",
      "TaskMarketActionProvider_delegate_to_taskmarket",
    ]);
    expect(provider.supportsNetwork({} as Network)).toBe(true);
  });

  it("converts USDC filters to base units and reads open tasks", async () => {
    const fetchMock = jest.fn().mockResolvedValue(response({ tasks: [{ id: taskId }] }));
    const provider = new TaskMarketActionProvider({
      apiBaseUrl: "https://example.test/",
      fetch: fetchMock,
    });

    const result = await provider.listTasks({
      minRewardUsdc: 1.25,
      maxRewardUsdc: 10,
      deadlineHours: 24,
      limit: 3,
      tags: ["coding", "ai"],
    });

    expect(JSON.parse(result)).toEqual({ tasks: [{ id: taskId }] });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/api/tasks?status=open&limit=3&tags=coding%2Cai&minReward=1250000&maxReward=10000000&deadlineHours=24",
      { headers: { Accept: "application/json" } },
    );
  });

  it("returns a plan without spending until explicit confirmation", async () => {
    const createTask = jest.fn();
    const provider = new TaskMarketActionProvider({ createTask });

    const result = JSON.parse(
      await provider.delegate({
        description: "Collect three public references",
        rewardUsdc: 2,
        durationHours: 12,
        maxSpendUsdc: 2,
        confirm: false,
      }),
    );

    expect(result.status).toBe("awaiting_confirmation");
    expect(result.plan.requiresExplicitConfirmation).toBe(true);
    expect(createTask).not.toHaveBeenCalled();
  });

  it("enforces the spending limit before invoking the payment adapter", async () => {
    const createTask = jest.fn();
    const provider = new TaskMarketActionProvider({ createTask });

    const result = JSON.parse(
      await provider.delegate({
        description: "Do the work",
        rewardUsdc: 5,
        durationHours: 1,
        maxSpendUsdc: 4,
        confirm: true,
      }),
    );

    expect(result).toEqual({
      status: "rejected",
      reason: "reward_exceeds_spending_limit",
      rewardUsdc: 5,
      maxSpendUsdc: 4,
    });
    expect(createTask).not.toHaveBeenCalled();
  });

  it("calls the injected adapter only after confirmation", async () => {
    const createTask = jest.fn().mockResolvedValue({ taskId, status: "open" });
    const provider = new TaskMarketActionProvider({ createTask });

    const result = JSON.parse(
      await provider.delegate({
        description: "Review a public API",
        rewardUsdc: 3,
        durationHours: 8,
        tags: ["research"],
        maxSpendUsdc: 3,
        confirm: true,
      }),
    );

    expect(result.status).toBe("created");
    expect(createTask).toHaveBeenCalledWith({
      description: "Review a public API",
      rewardUsdc: 3,
      durationHours: 8,
      tags: ["research"],
    });
  });

  it("turns API errors into useful action failures", async () => {
    const provider = new TaskMarketActionProvider({
      fetch: jest.fn().mockResolvedValue(response({ message: "not found" }, 404)),
    });

    await expect(provider.getTask({ taskId })).rejects.toThrow("not found");
  });
});
