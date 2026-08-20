import { taskmarketActionProvider } from "./taskmarketActionProvider";

const TASK_ID = `0x${"a".repeat(64)}`;
const task = {
  id: TASK_ID,
  reward: "4000000",
  netReward: "3700000",
  platformFeeBps: 750,
  submissionCount: 3,
  status: "open",
  phase: "active",
  submissionWindowOpen: true,
  pendingActions: [{ action: "submit", actor: "worker", requiresPayment: false }],
};

describe("TaskmarketActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;
  beforeEach(() => jest.resetAllMocks());

  it("lists tasks with USDC converted to base units", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ tasks: [task] }) });
    await taskmarketActionProvider().listTasks({ mode: "bounty", tags: ["typescript"], minRewardUsdc: 2.5, deadlineHours: 24, limit: 10 });
    expect(fetchMock.mock.calls[0][0]).toContain("minReward=2500000");
    expect(fetchMock.mock.calls[0][0]).toContain("tags=typescript");
  });

  it("calculates competition-adjusted expected value", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => task });
    const result = JSON.parse(await taskmarketActionProvider().analyzeTaskEconomics({ taskId: TASK_ID, estimatedHours: 2, probabilityOfWinning: null }));
    expect(result.netRewardUsdc).toBe(3.7);
    expect(result.probabilityOfWinning).toBe(0.25);
    expect(result.expectedHourlyUsdc).toBe(0.4625);
  });

  it("blocks submissions by default", async () => {
    const result = JSON.parse(await taskmarketActionProvider().submit({ taskId: TASK_ID, files: ["result.md"], confirmation: "SUBMIT TASKMARKET WORK" }));
    expect(result.error).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires exact confirmation before submission", async () => {
    const submitWork = jest.fn();
    const provider = taskmarketActionProvider({ allowSubmissions: true, submitWork });
    const result = JSON.parse(await provider.submit({ taskId: TASK_ID, files: ["result.md"], confirmation: "yes" }));
    expect(result.error).toBe(true);
    expect(submitWork).not.toHaveBeenCalled();
  });

  it("revalidates free submission eligibility before delegating", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => task });
    const submitWork = jest.fn().mockResolvedValue({ submissionId: "sub_1" });
    const provider = taskmarketActionProvider({ allowSubmissions: true, submitWork });
    const result = JSON.parse(await provider.submit({ taskId: TASK_ID, files: ["result.md"], confirmation: "SUBMIT TASKMARKET WORK" }));
    expect(result.success).toBe(true);
    expect(submitWork).toHaveBeenCalledWith({ taskId: TASK_ID, files: ["result.md"] });
  });

  it("returns structured API errors", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const result = JSON.parse(await taskmarketActionProvider().getTask({ taskId: TASK_ID }));
    expect(result.details).toBe("HTTP 503");
  });
});

