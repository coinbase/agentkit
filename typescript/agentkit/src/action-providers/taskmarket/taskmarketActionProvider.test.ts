import { TaskMarketActionProvider } from "./taskmarketActionProvider";
import { hoursUntil, isOpenForWork, matchScore, summarize, toUsdc } from "./utils";
import { TaskMarketTask } from "./types";

const HOUR = 3_600_000;

/**
 * Builds a task fixture with sensible open defaults.
 *
 * @param over - Fields to override on the fixture.
 * @returns A task object.
 */
function task(over: Partial<TaskMarketTask> = {}): TaskMarketTask {
  return {
    id: `0x${"a".repeat(64)}`,
    description: "Build a video pipeline for onchain agents",
    status: "open",
    netReward: 20_000_000,
    submissionCount: 3,
    expiryTime: new Date(Date.now() + 48 * HOUR).toISOString(),
    submissionWindowOpen: true,
    tags: ["video", "agents"],
    ...over,
  };
}

describe("TaskMarket utils", () => {
  it("converts USDC base units from both strings and numbers", () => {
    expect(toUsdc(20_000_000)).toBe(20);
    expect(toUsdc("1500000")).toBe(1.5);
    expect(toUsdc(undefined)).toBe(0);
    expect(toUsdc("not-a-number")).toBe(0);
  });

  it("computes hours remaining and tolerates bad input", () => {
    const soon = new Date(Date.now() + 2 * HOUR).toISOString();
    expect(hoursUntil(soon)).toBeGreaterThan(1.5);
    expect(hoursUntil(soon)).toBeLessThan(2.5);
    expect(hoursUntil(undefined)).toBeNull();
    expect(hoursUntil("nonsense")).toBeNull();
  });

  it("collapses long descriptions to a single line", () => {
    const out = summarize("a".repeat(500));
    expect(out.length).toBeLessThanOrEqual(140);
    expect(summarize("short\n\ndescription")).toBe("short description");
  });

  it("treats expired or closed tasks as not open, even when status says open", () => {
    expect(isOpenForWork(task())).toBe(true);
    expect(isOpenForWork(task({ status: "closed" }))).toBe(false);
    expect(isOpenForWork(task({ submissionWindowOpen: false }))).toBe(false);
    expect(
      isOpenForWork(task({ expiryTime: new Date(Date.now() - HOUR).toISOString() })),
    ).toBe(false);
  });

  it("scores keyword overlap and ignores stopwords", () => {
    expect(matchScore(task(), "video pipeline")).toBe(2);
    expect(matchScore(task(), "the and for with")).toBe(0);
    expect(matchScore(task(), "quantum knitting")).toBe(0);
  });
});

describe("TaskMarketActionProvider", () => {
  const provider = new TaskMarketActionProvider({ baseUrl: "https://example.test/api" });
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("supports every network, since discovery touches no wallet", () => {
    expect(provider.supportsNetwork({ protocolFamily: "evm" })).toBe(true);
    expect(provider.supportsNetwork({ protocolFamily: "svm" })).toBe(true);
  });

  it("lists open tasks sorted by reward", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        tasks: [
          task({ id: `0x${"1".repeat(64)}`, netReward: 1_000_000 }),
          task({ id: `0x${"2".repeat(64)}`, netReward: 64_000_000 }),
        ],
      }),
    });

    const out = await provider.browseTasks({ limit: 10 });
    expect(out).toContain("64.000 USDC");
    expect(out.indexOf("64.000 USDC")).toBeLessThan(out.indexOf("1.000 USDC"));
  });

  it("filters out tasks below the reward floor", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ tasks: [task({ netReward: 500_000 })] }),
    });

    const out = await provider.browseTasks({ limit: 10, minRewardUsdc: 5 });
    expect(out).toContain("No open TaskMarket tasks matched");
  });

  it("excludes expired tasks from browse results", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        tasks: [task({ expiryTime: new Date(Date.now() - HOUR).toISOString() })],
      }),
    });

    const out = await provider.browseTasks({ limit: 10 });
    expect(out).toContain("No open TaskMarket tasks matched");
  });

  it("returns an error string rather than throwing on API failure", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    const out = await provider.browseTasks({ limit: 5 });
    expect(out).toContain("Could not browse TaskMarket tasks");
    expect(out).toContain("503");
  });

  it("surfaces matching work for delegation and refuses to act on it", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ tasks: [task()] }),
    });

    const out = await provider.evaluateDelegation({
      workDescription: "produce a video for an agent",
      limit: 5,
    });
    expect(out).toContain("overlap with that work");
    expect(out).toContain("explicit");
  });

  it("reports plainly when nothing matches", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ tasks: [task()] }),
    });

    const out = await provider.evaluateDelegation({
      workDescription: "underwater basket weaving",
      limit: 5,
    });
    expect(out).toContain("does not appear to be already funded");
  });

  it("renders full task detail", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => task({ description: "Acceptance criteria here" }),
    });

    const out = await provider.getTaskDetails({ taskId: `0x${"a".repeat(64)}` });
    expect(out).toContain("Acceptance criteria here");
    expect(out).toContain("Net reward: 20.000000 USDC");
  });
});
