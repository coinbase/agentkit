import { taskmarketActionProvider } from "./taskmarketActionProvider";

describe("TaskMarketActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const provider = taskmarketActionProvider();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  const mockTask = {
    id: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    reward: 1000000,
    status: "open",
    mode: "bounty",
    submissionCount: 3,
    expiryTime: "2026-08-15T00:00:00Z",
    tags: ["integration"],
    description: "Integrate TaskMarket into an agentic product",
  };

  describe("fetchOpenTasks", () => {
    it("should return ranked open tasks when API call is successful", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ tasks: [mockTask] }),
      });

      const result = await provider.fetchOpenTasks({ limit: 10 });
      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe(mockTask.id);
      expect(parsed[0].reward).toBe(1000000);
    });

    it("should rank by submission count ascending", async () => {
      const two = {
        ...mockTask,
        id: "0x2222",
        submissionCount: 2,
      };
      const ten = { ...mockTask, id: "0xaaaa", submissionCount: 10 };
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ tasks: [ten, two] }),
      });

      const result = await provider.fetchOpenTasks({ limit: 10 });
      const parsed = JSON.parse(result);
      expect(parsed[0].id).toBe("0x2222");
      expect(parsed[1].id).toBe("0xaaaa");
    });

    it("should apply query filter", async () => {
      const unrelated = { ...mockTask, description: "unrelated" };
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ tasks: [mockTask, unrelated] }),
      });

      const result = await provider.fetchOpenTasks({ query: "integrate" });
      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe(mockTask.id);
    });

    it("should handle API errors gracefully", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 502 });
      const result = await provider.fetchOpenTasks({ limit: 10 });
      expect(result).toContain("Error fetching TaskMarket tasks");
      expect(result).toContain("502");
    });

    it("should handle network errors", async () => {
      fetchMock.mockRejectedValue(new Error("Network error"));
      const result = await provider.fetchOpenTasks({ limit: 10 });
      expect(result).toContain("Error fetching TaskMarket tasks");
      expect(result).toContain("Network error");
    });

    it("should return a no-results message when empty", async () => {
      fetchMock.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue({ tasks: [] }) });
      const result = await provider.fetchOpenTasks({ limit: 10 });
      expect(result).toContain("No open TaskMarket tasks");
    });

    it("should respect minReward filter", async () => {
      const small = { ...mockTask, reward: 100 };
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ tasks: [mockTask, small] }),
      });

      const result = await provider.fetchOpenTasks({ minReward: 1000000 });
      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].reward).toBe(1000000);
    });
  });

  describe("getTask", () => {
    it("should return task details when API call is successful", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTask),
      });

      const result = await provider.getTask({ taskId: mockTask.id });
      expect(JSON.parse(result).id).toBe(mockTask.id);
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`/api/tasks/${mockTask.id}`));
    });

    it("should handle API errors gracefully", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 404 });
      const result = await provider.getTask({ taskId: mockTask.id });
      expect(result).toContain("Error fetching TaskMarket task");
      expect(result).toContain("404");
    });
  });
});
