import { TaskMarketActionProvider } from "./taskmarketActionProvider";

describe("TaskMarketActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;
  const provider = new TaskMarketActionProvider();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("discovers and filters open tasks without wallet interaction", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([
        {
          id: `0x${"1".repeat(64)}`,
          description: "Build an MCP adapter",
          reward: "2000000",
          netReward: "1850000",
          status: "open",
          mode: "bounty",
          tags: ["mcp"],
          escrowTxHash: `0x${"2".repeat(64)}`,
        },
        {
          id: `0x${"3".repeat(64)}`,
          description: "Write documentation",
          reward: "500000",
          status: "open",
          tags: ["docs"],
        },
      ]),
    });

    const result = JSON.parse(
      await provider.discoverTasks({ keyword: "mcp", maxRewardUsdc: 2, limit: 10 }),
    );

    expect(result.success).toBe(true);
    expect(result.readOnly).toBe(true);
    expect(result.totalReturned).toBe(1);
    expect(result.tasks[0]).toMatchObject({
      rewardUsdc: 2,
      netRewardUsdc: 1.85,
      escrowTxHash: `0x${"2".repeat(64)}`,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.taskmarket.dev/api/tasks?status=open&limit=10",
    );
  });

  it("returns a complete task record read-only", async () => {
    const task = { id: `0x${"a".repeat(64)}`, description: "A task", reward: "1000000" };
    fetchMock.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(task) });

    const result = JSON.parse(await provider.getTask({ taskId: task.id }));

    expect(result).toEqual({ success: true, readOnly: true, task });
    expect(fetchMock).toHaveBeenCalledWith(`https://api.taskmarket.dev/api/tasks/${task.id}`);
  });

  it("surfaces API failures as structured errors", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    const result = JSON.parse(
      await provider.discoverTasks({ keyword: null, maxRewardUsdc: null, limit: null }),
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("HTTP 503");
  });
});
