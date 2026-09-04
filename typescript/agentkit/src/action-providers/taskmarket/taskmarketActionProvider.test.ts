import { taskmarketActionProvider } from "./taskmarketActionProvider";
import { baseUnitsToUsdc, compactTask, summarizeDescription } from "./utils";

describe("TaskMarketActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const provider = taskmarketActionProvider();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("utils", () => {
    it("converts base units to usdc", () => {
      expect(baseUnitsToUsdc("4500000")).toBe("4.5");
      expect(baseUnitsToUsdc(1000000)).toBe("1");
    });

    it("summarizes descriptions", () => {
      expect(summarizeDescription("a".repeat(10), 20)).toHaveLength(10);
      expect(summarizeDescription("a".repeat(50), 20).endsWith("…")).toBe(true);
    });

    it("compacts tasks", () => {
      const c = compactTask({
        id: "0x" + "ab".repeat(32),
        mode: "bounty",
        status: "open",
        reward: "2000000",
        netReward: "1850000",
        submissionCount: 3,
        tags: ["ai"],
        description: "Build a thing",
        submissionWindowOpen: true,
        expiryTime: new Date(Date.now() + 3600_000).toISOString(),
      });
      expect(c.rewardUsdc).toBe("2");
      expect(c.netRewardUsdc).toBe("1.85");
      expect(c.mode).toBe("bounty");
      expect(c.url).toContain(c.id);
    });
  });

  describe("listOpenTasks", () => {
    it("returns compact tasks on success", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          tasks: [
            {
              id: "0x" + "11".repeat(32),
              mode: "bounty",
              status: "open",
              reward: "1000000",
              netReward: "925000",
              submissionCount: 2,
              tags: ["crypto"],
              description: "Do work",
              submissionWindowOpen: true,
              expiryTime: new Date(Date.now() + 7200_000).toISOString(),
            },
          ],
        }),
      });

      const result = await provider.listOpenTasks({
        limit: 5,
        mode: "bounty",
        sort: "reward_desc",
        tags: null,
        minRewardUsdc: null,
      });
      const parsed = JSON.parse(result);
      expect(parsed.count).toBe(1);
      expect(parsed.tasks[0].rewardUsdc).toBe("1");
      expect(fetchMock).toHaveBeenCalled();
      const calledUrl = String(fetchMock.mock.calls[0][0]);
      expect(calledUrl).toContain("/tasks?");
      expect(calledUrl).toContain("status=open");
    });

    it("handles HTTP errors", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });
      const result = await provider.listOpenTasks({
        limit: null,
        mode: null,
        sort: null,
        tags: null,
        minRewardUsdc: null,
      });
      expect(result).toContain("Error listing TaskMarket tasks");
    });
  });

  describe("getTask", () => {
    it("rejects bad ids", async () => {
      const result = await provider.getTask({ taskId: "not-an-id" });
      expect(result).toContain("Error: taskId must be");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns task details", async () => {
      const id = "0x" + "22".repeat(32);
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          id,
          mode: "bounty",
          status: "open",
          reward: "5000000",
          netReward: "4625000",
          submissionCount: 1,
          tags: ["ai"],
          description: "Integrate TaskMarket",
          submissionWindowOpen: true,
          requester: "0xabc",
          pendingActions: [
            {
              role: "worker",
              action: "submit",
              requiresPayment: false,
              paymentAmount: null,
            },
          ],
        }),
      });
      const result = await provider.getTask({ taskId: id });
      const parsed = JSON.parse(result);
      expect(parsed.id).toBe(id);
      expect(parsed.rewardUsdc).toBe("5");
      expect(parsed.pendingActions[0].action).toBe("submit");
    });
  });

  describe("suggestDelegation", () => {
    it("asks for budget when external work detected", async () => {
      const result = await provider.suggestDelegation({
        userRequest: "Please hire someone to build a full game and production video",
        estimatedLocalEffortHours: 5,
        budgetUsdc: null,
      });
      const parsed = JSON.parse(result);
      expect(parsed.recommendation).toBe("need_user_budget");
    });

    it("offers taskmarket when budget exists", async () => {
      const result = await provider.suggestDelegation({
        userRequest: "Outsource a research report",
        estimatedLocalEffortHours: 3,
        budgetUsdc: 10,
      });
      const parsed = JSON.parse(result);
      expect(parsed.recommendation).toBe("offer_taskmarket");
    });

    it("prefers local for trivial requests", async () => {
      const result = await provider.suggestDelegation({
        userRequest: "What is 2+2?",
        estimatedLocalEffortHours: 0.01,
        budgetUsdc: null,
      });
      const parsed = JSON.parse(result);
      expect(parsed.recommendation).toBe("do_locally");
    });
  });

  describe("supportsNetwork", () => {
    it("returns true", () => {
      expect(provider.supportsNetwork()).toBe(true);
    });
  });
});
