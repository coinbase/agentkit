import {
  taskmarketActionProvider,
  fromTaskmarketBaseUnits,
  toTaskmarketBaseUnits,
} from "./taskmarketActionProvider";

describe("TaskmarketActionProvider", () => {
  const fetchMock = jest.fn();
  const provider = taskmarketActionProvider({
    apiUrl: "https://taskmarket.example",
    maxRewardUsdc: 5,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock;
  });

  it("converts USDC amounts to and from Taskmarket base units", () => {
    expect(toTaskmarketBaseUnits(5)).toBe("5000000");
    expect(toTaskmarketBaseUnits(0.125)).toBe("125000");
    expect(fromTaskmarketBaseUnits("5500000")).toBe(5.5);
    expect(fromTaskmarketBaseUnits("not-a-number")).toBeNull();
  });

  it("lists compact task summaries and applies discovery filters", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        tasks: [
          {
            id: "0x" + "1".repeat(64),
            description: "A public API task",
            reward: "6000000",
            netReward: "5550000",
            status: "open",
            phase: "active",
            mode: "bounty",
            tags: ["api"],
            submissionCount: 2,
            awardCount: 0,
          },
        ],
        hasMore: true,
        nextCursor: "2026-08-18T00:00:00.000Z",
      }),
    });

    const result = await provider.listTasks({
      minRewardUsdc: 5,
      tags: ["api"],
      sort: "reward_desc",
      limit: 10,
    });
    const parsed = JSON.parse(result);
    const requestUrl = new URL(fetchMock.mock.calls[0][0]);

    expect(parsed.success).toBe(true);
    expect(parsed.tasks[0]).toMatchObject({
      rewardUsdc: 6,
      netRewardUsdc: 5.55,
      descriptionTruncated: false,
    });
    expect(requestUrl.pathname).toBe("/api/tasks");
    expect(requestUrl.searchParams.get("status")).toBe("open");
    expect(requestUrl.searchParams.get("minReward")).toBe("5000000");
    expect(requestUrl.searchParams.get("tags")).toBe("api");
    expect(requestUrl.searchParams.get("sort")).toBe("reward_desc");
  });

  it("returns the full task detail", async () => {
    const task = {
      id: "0x" + "2".repeat(64),
      description: "Inspect this task",
      reward: "1000000",
      pendingActions: [{ role: "worker", action: "submit" }],
    };
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(task),
    });

    const result = await provider.getTask({ taskId: task.id });

    expect(JSON.parse(result)).toEqual({ success: true, task });
    expect(fetchMock).toHaveBeenCalledWith(`https://taskmarket.example/api/tasks/${task.id}`);
  });

  it("does not contact the paid endpoint before explicit confirmation", async () => {
    const wallet = {} as never;
    const result = await provider.createTask(wallet, {
      description: "Delegate a bounded public API check",
      rewardUsdc: 2,
      durationHours: 4,
      tags: ["api"],
      confirm: false,
    });
    const parsed = JSON.parse(result);

    expect(parsed.status).toBe("confirmation_required");
    expect(parsed.task.reward).toBe("2000000");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a confirmed escrow above the configured limit", async () => {
    const result = await provider.createTask({} as never, {
      description: "This should not be sent",
      rewardUsdc: 5.01,
      durationHours: 1,
      confirm: true,
    });

    const parsed = JSON.parse(result);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("exceeds the configured maximum");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports HTTP errors without throwing", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: jest.fn().mockResolvedValue({ message: "temporarily unavailable" }),
    });

    const result = await provider.listTasks({});
    const parsed = JSON.parse(result);

    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("HTTP 503");
  });
});
