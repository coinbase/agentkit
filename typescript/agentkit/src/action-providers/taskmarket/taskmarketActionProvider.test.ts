import { execFile } from "child_process";
import type { EvmWalletProvider } from "../../wallet-providers";
import { taskmarketActionProvider, TaskmarketActionProvider } from "./taskmarketActionProvider";

jest.mock("child_process", () => ({
  execFile: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const execFileMock = execFile as any;

// Minimal EvmWalletProvider-like object for create_task network checks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const baseWallet = {
  getNetwork: () => ({ chainId: "8453", protocolFamily: "evm", networkId: "base-mainnet" }),
} as unknown as EvmWalletProvider;

const validArgs = {
  description: "Build a small browser game",
  rewardUsdc: 5,
  durationHours: 72,
  mode: "bounty" as const,
  taskVisibility: "public" as const,
  submissionVisibility: "public" as const,
  tags: ["game"],
  maxSpendUsdc: undefined,
  authorization: "I authorize paying 5 USDC",
};

describe("TaskmarketActionProvider", () => {
  const apiBase = "https://api.taskmarket.dev/api";
  const fetchMock = jest.fn();

  beforeAll(() => {
    global.fetch = fetchMock;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).fetch;
  });

  describe("listTasks", () => {
    it("should return parsed open tasks and pagination cursor", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tasks: [
            {
              id: "0xaaa",
              reward: "6000000",
              mode: "bounty",
              status: "open",
              phase: "active",
              submissionWindowOpen: true,
              submissionCount: 10,
              awardCount: 0,
              expiryTime: "2026-08-20T00:00:00Z",
            },
            {
              id: "0xbbb",
              reward: "2000000",
              mode: "bounty",
              status: "open",
              phase: "active",
              submissionWindowOpen: true,
              submissionCount: 1,
              awardCount: 0,
              expiryTime: "2026-08-21T00:00:00Z",
            },
          ],
          hasMore: true,
          nextCursor: "cursor-1",
        }),
      });

      const result = await taskmarketActionProvider().listTasks({});
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.count).toBe(2);
      expect(parsed.tasks[0].rewardUsdc).toBe(6);
      expect(parsed.tasks[0].id).toBe("0xaaa");
      expect(parsed.nextCursor).toBe("cursor-1");
      expect(fetchMock).toHaveBeenCalledWith(`${apiBase}/tasks?`);
    });

    it("should filter by maxRewardUsdc", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tasks: [
            {
              id: "0xaaa",
              reward: "6000000",
              mode: "bounty",
              status: "open",
              phase: "active",
              submissionWindowOpen: true,
            },
            {
              id: "0xbbb",
              reward: "2000000",
              mode: "bounty",
              status: "open",
              phase: "active",
              submissionWindowOpen: true,
            },
          ],
          hasMore: false,
          nextCursor: null,
        }),
      });

      const result = await taskmarketActionProvider().listTasks({
        mode: "bounty",
        maxRewardUsdc: 3,
      });
      const parsed = JSON.parse(result);

      expect(parsed.count).toBe(1);
      expect(parsed.tasks[0].id).toBe("0xbbb");
    });

    it("should surface an HTTP error", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await taskmarketActionProvider().listTasks({});
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("500");
    });
  });

  describe("getTask", () => {
    it("should return the live task status with reward in whole USDC", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "0xabc",
          description: "Do work",
          reward: "4500000",
          mode: "bounty",
          status: "open",
          phase: "active",
          submissionWindowOpen: true,
          submissionCount: 4,
          awardCount: 0,
          expiryTime: "2026-08-22T00:00:00Z",
          taskVisibility: "public",
          submissionVisibility: "public",
          platformFeeBps: 250,
        }),
      });

      const result = await taskmarketActionProvider().getTask({ taskId: "0xabc" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.task.rewardUsdc).toBe(4.5);
      expect(parsed.task.submissionWindowOpen).toBe(true);
      expect(parsed.task.id).toBe("0xabc");
    });
  });

  describe("listSubmissions", () => {
    it("should return pending submissions with rejected state", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: "sub-1",
            workerAddress: "0x111",
            submittedAt: "2026-08-19T00:00:00Z",
            rejectedAt: null,
          },
          {
            id: "sub-2",
            workerAddress: "0x222",
            submittedAt: "2026-08-19T01:00:00Z",
            rejectedAt: "2026-08-19T02:00:00Z",
          },
        ],
      });

      const result = await taskmarketActionProvider().listSubmissions({ taskId: "0xabc" });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.total).toBe(2);
      expect(parsed.submissions[0].status).toBe("pending_review");
      expect(parsed.submissions[1].status).toBe("rejected");
    });
  });

  describe("createTask", () => {
    it("should refuse creation when not on Base", async () => {
      const notBase = {
        getNetwork: () => ({ chainId: "1", protocolFamily: "evm", networkId: "ethereum-mainnet" }),
      } as unknown as EvmWalletProvider;

      const result = await taskmarketActionProvider().createTask(notBase, validArgs);
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("only be created on Base");
      expect(execFileMock).not.toHaveBeenCalled();
    });

    it("should refuse creation when it exceeds the max-spend cap", async () => {
      const result = await taskmarketActionProvider().createTask(baseWallet, {
        ...validArgs,
        rewardUsdc: 100,
        authorization: "I authorize paying 100 USDC",
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("exceeds the max-spend cap");
      expect(execFileMock).not.toHaveBeenCalled();
    });

    it("should refuse creation without explicit authorization matching the exact total", async () => {
      const result = await taskmarketActionProvider().createTask(baseWallet, {
        ...validArgs,
        authorization: "I authorize paying 4 USDC",
      });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("no valid explicit authorization");
      expect(execFileMock).not.toHaveBeenCalled();
    });

    it("should delegate the funded write to the CLI and return the task id", async () => {
      const taskId = `0x${"a".repeat(64)}`;
      execFileMock.mockImplementation((_cli, _args, _opts, cb) => {
        cb(null, {
          stdout: `Created task ${taskId}\nTask URL: https://taskmarket.dev/tasks/${taskId}\n`,
          stderr: "",
        });
      });

      const result = await taskmarketActionProvider().createTask(baseWallet, validArgs);
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.taskId).toBe(taskId);
      expect(parsed.network).toBe("base:8453");
      expect(execFileMock).toHaveBeenCalledTimes(1);
      const cliArgs = execFileMock.mock.calls[0][1];
      expect(cliArgs).toContain("create");
      expect(cliArgs).toContain("--reward");
      expect(cliArgs).toContain("5");
      expect(cliArgs).toContain("--duration");
      expect(cliArgs).toContain("--tags");
    });

    it("should surface CLI failure without resubmitting", async () => {
      execFileMock.mockImplementation((_cli, _args, _opts, cb) => {
        cb(new Error("Task not created"));
      });

      const result = await taskmarketActionProvider().createTask(baseWallet, validArgs);
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Taskmarket task creation failed");
    });
  });

  describe("supportsNetwork", () => {
    it("should support EVM networks", () => {
      expect(taskmarketActionProvider().supportsNetwork({ protocolFamily: "evm" })).toBe(true);
      expect(taskmarketActionProvider().supportsNetwork({ protocolFamily: "svm" } as never)).toBe(
        false,
      );
    });
  });

  describe("TaskmarketActionProvider config", () => {
    it("should allow overriding the spend cap and CLI", () => {
      const provider = new TaskmarketActionProvider({ maxSpendUsdc: 2, cli: "my-taskmarket" });
      expect(provider).toBeInstanceOf(TaskmarketActionProvider);
    });
  });
});
