import { taskmarketActionProvider } from "./taskmarketActionProvider";

describe("TaskMarketActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;
  const provider = taskmarketActionProvider();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("listOpenTasks", () => {
    it("returns mapped tasks on success", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          tasks: [
            {
              id: "0xabc",
              mode: "bounty",
              reward: "1500000",
              submissionCount: 2,
              tags: ["ai"],
              description: "Hello world task",
            },
          ],
        }),
      });
      const result = await provider.listOpenTasks({
        limit: 5,
        mode: null,
        tags: null,
      });
      const parsed = JSON.parse(result);
      expect(parsed.count).toBe(1);
      expect(parsed.tasks[0].rewardUsdcApprox).toBe(1.5);
    });

    it("handles API errors", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });
      const result = await provider.listOpenTasks({
        limit: null,
        mode: null,
        tags: null,
      });
      expect(result).toContain("Error listing TaskMarket tasks");
    });
  });

  describe("prepareDelegation", () => {
    it("returns pending_approval when not authorized", async () => {
      const result = await provider.prepareDelegation({
        description: "demo",
        rewardUsdc: 1,
        durationHours: 24,
        spendingLimitUsdc: 5,
        userAuthorized: false,
        mode: null,
      });
      expect(JSON.parse(result).status).toBe("pending_approval");
    });

    it("rejects over spending limit", async () => {
      const result = await provider.prepareDelegation({
        description: "demo",
        rewardUsdc: 10,
        durationHours: 24,
        spendingLimitUsdc: 5,
        userAuthorized: true,
        mode: "bounty",
      });
      expect(JSON.parse(result).status).toBe("rejected");
    });
  });

  describe("submitWork", () => {
    it("blocks when userAuthorized is false", async () => {
      const result = await provider.submitWork({
        taskId: "0xabc",
        deliverableSummary: "x",
        artifactPaths: null,
        userAuthorized: false,
      });
      expect(JSON.parse(result).status).toBe("blocked");
    });

    it("returns plan when authorized", async () => {
      const result = await provider.submitWork({
        taskId: "https://taskmarket.dev/tasks/0xdeadbeef",
        deliverableSummary: "evidence",
        artifactPaths: ["a.md"],
        userAuthorized: true,
      });
      const parsed = JSON.parse(result);
      expect(parsed.status).toBe("authorized_submission_plan");
      expect(parsed.taskId).toBe("0xdeadbeef");
    });
  });

  describe("supportsNetwork", () => {
    it("supports all networks", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" }),
      ).toBe(true);
    });
  });
});
