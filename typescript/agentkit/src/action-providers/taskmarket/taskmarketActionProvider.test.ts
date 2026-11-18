import { TaskmarketActionProvider } from "./taskmarketActionProvider";
import { issueConfirmationToken } from "./confirmation";
import { CliResult, TaskmarketCli } from "./cli";
import { TaskmarketApiClient } from "./api";

const OPEN_TASK = {
  id: "0x" + "ab".repeat(32),
  status: "open",
  phase: "active",
  mode: "bounty",
  reward: "4500000",
  netReward: "4162500",
  submissionCount: 2,
  expiryTime: "2026-08-22T11:58:25.795Z",
  createdAt: "2026-08-08T11:58:25.806Z",
  tags: ["ai", "agents"],
  description: "Submit one genuine integration of TaskMarket.",
};

function previewArgs() {
  return {
    description: "Write a one-page report on Base USDC settlement for Taskmarket agents.",
    rewardUsdc: 1,
    durationHours: 48,
    mode: "bounty" as const,
    tags: "research",
    deliverables: "One markdown report with sources.",
  };
}

describe("TaskmarketActionProvider", () => {
  let apiCalls: string[];
  let cliCalls: string[][];
  let cliResult: CliResult;
  let provider: TaskmarketActionProvider;

  beforeEach(() => {
    apiCalls = [];
    cliCalls = [];
    cliResult = { exitCode: 0, timedOut: false, stdout: JSON.stringify({ data: { id: OPEN_TASK.id } }), stderr: "" };

    const apiClient: TaskmarketApiClient = {
      getJson: async (path: string) => {
        apiCalls.push(path);
        if (path.startsWith("/tasks?") || path === "/tasks") {
          return { tasks: [OPEN_TASK] };
        }
        if (path.endsWith("/submissions")) {
          return [{ id: "sub_1", workerAddress: "0xabc", submittedAt: "2026-08-13T00:00:00.000Z" }];
        }
        return OPEN_TASK;
      },
    };

    const cli: TaskmarketCli = {
      run: async (args: string[]) => {
        cliCalls.push(args);
        return cliResult;
      },
    };

    provider = new TaskmarketActionProvider({
      maxSpendUsdc: 5,
      apiClient,
      cli,
    });
  });

  describe("list_taskmarket_tasks", () => {
    it("returns summarized public tasks without spending", async () => {
      const response = JSON.parse(await provider.listTasks({ status: "open", limit: 10 }));

      expect(response.success).toBe(true);
      expect(response.network.chainId).toBe(8453);
      expect(response.tasks[0].rewardUsdc).toBe(4.5);
      expect(response.tasks[0].url).toContain(OPEN_TASK.id);
      expect(apiCalls[0]).toContain("/tasks?");
      expect(cliCalls).toHaveLength(0);
    });

    it("surfaces API failures", async () => {
      const failing = new TaskmarketActionProvider({
        maxSpendUsdc: 5,
        apiClient: {
          getJson: async () => {
            throw new Error("boom");
          },
        },
        cli: { run: async () => cliResult },
      });

      const response = JSON.parse(await failing.listTasks({}));
      expect(response.error).toBe(true);
      expect(response.details).toContain("boom");
    });
  });

  describe("get_taskmarket_task", () => {
    it("returns live status for a task id", async () => {
      const response = JSON.parse(await provider.getTask({ taskId: OPEN_TASK.id }));
      expect(response.success).toBe(true);
      expect(response.status).toBe("open");
      expect(response.url).toBe(`https://taskmarket.dev/tasks/${OPEN_TASK.id}`);
    });
  });

  describe("preview_taskmarket_task", () => {
    it("does not call the CLI and returns a confirmation token", async () => {
      const response = JSON.parse(await provider.previewTask(previewArgs()));
      expect(response.success).toBe(true);
      expect(response.fundsMoved).toBe(false);
      expect(response.preview.chainId).toBe(8453);
      expect(response.preview.rewardUsdc).toBe(1);
      expect(response.confirmationToken).toContain(".");
      expect(cliCalls).toHaveLength(0);
    });

    it("blocks previews above the spend cap", async () => {
      const response = JSON.parse(
        await provider.previewTask({ ...previewArgs(), rewardUsdc: 99 }),
      );
      expect(response.error).toBe(true);
      expect(response.message).toContain("maxSpendUsdc");
    });

    it("blocks creates when maxSpendUsdc is 0", async () => {
      const locked = new TaskmarketActionProvider({
        maxSpendUsdc: 0,
        apiClient: { getJson: async () => ({ tasks: [] }) },
        cli: { run: async () => cliResult },
      });
      const response = JSON.parse(await locked.previewTask(previewArgs()));
      expect(response.error).toBe(true);
      expect(response.message).toContain("maxSpendUsdc is 0");
    });
  });

  describe("create_taskmarket_task", () => {
    it("refuses to create without explicit authorization", async () => {
      const preview = JSON.parse(await provider.previewTask(previewArgs()));
      const response = JSON.parse(
        await provider.createTask({
          ...previewArgs(),
          confirmationToken: preview.confirmationToken,
          iAuthorizeSpend: false,
        }),
      );
      expect(response.error).toBe(true);
      expect(response.message).toContain("authorization");
      expect(cliCalls).toHaveLength(0);
    });

    it("refuses a token that does not match the payload", async () => {
      const other = issueConfirmationToken({
        description: "A completely different task description for mismatch.",
        rewardUsdc: 1,
        durationHours: 48,
        mode: "bounty",
        tags: "research",
        deliverables: "One markdown report with sources.",
      });
      const response = JSON.parse(
        await provider.createTask({
          ...previewArgs(),
          confirmationToken: other,
          iAuthorizeSpend: true,
        }),
      );
      expect(response.error).toBe(true);
      expect(response.message).toContain("does not match");
      expect(cliCalls).toHaveLength(0);
    });

    it("creates through the official CLI after preview + authorization", async () => {
      const preview = JSON.parse(await provider.previewTask(previewArgs()));
      const response = JSON.parse(
        await provider.createTask({
          ...previewArgs(),
          confirmationToken: preview.confirmationToken,
          iAuthorizeSpend: true,
        }),
      );

      expect(response.success).toBe(true);
      expect(response.taskId).toBe(OPEN_TASK.id);
      expect(response.url).toContain(OPEN_TASK.id);
      expect(cliCalls[0]).toEqual([
        "task",
        "create",
        "--description",
        previewArgs().description,
        "--reward",
        "1",
        "--duration",
        "48",
        "--mode",
        "bounty",
        "--tags",
        "research",
      ]);
    });

    it("does not retry when settlement is unknown", async () => {
      cliResult = { exitCode: null, timedOut: true, stdout: "", stderr: "timeout" };
      const preview = JSON.parse(await provider.previewTask(previewArgs()));
      const first = JSON.parse(
        await provider.createTask({
          ...previewArgs(),
          confirmationToken: preview.confirmationToken,
          iAuthorizeSpend: true,
        }),
      );
      expect(first.settlementUnknown).toBe(true);

      cliResult = { exitCode: 0, timedOut: false, stdout: "{}", stderr: "" };
      const second = JSON.parse(
        await provider.createTask({
          ...previewArgs(),
          confirmationToken: preview.confirmationToken,
          iAuthorizeSpend: true,
        }),
      );
      expect(second.error).toBe(true);
      expect(second.message).toContain("unknown settlement");
      expect(cliCalls).toHaveLength(1);
    });

    it("blocks a duplicate create of the same payload", async () => {
      const preview = JSON.parse(await provider.previewTask(previewArgs()));
      await provider.createTask({
        ...previewArgs(),
        confirmationToken: preview.confirmationToken,
        iAuthorizeSpend: true,
      });
      const again = JSON.parse(
        await provider.createTask({
          ...previewArgs(),
          confirmationToken: preview.confirmationToken,
          iAuthorizeSpend: true,
        }),
      );
      expect(again.error).toBe(true);
      expect(again.message).toContain("already submitted");
      expect(cliCalls).toHaveLength(1);
    });
  });

  describe("list_taskmarket_submissions", () => {
    it("returns submissions for human review and never auto-accepts", async () => {
      const response = JSON.parse(await provider.listSubmissions({ taskId: OPEN_TASK.id }));
      expect(response.success).toBe(true);
      expect(response.autoAccept).toBe(false);
      expect(response.autoReject).toBe(false);
      expect(response.reviewOnly).toBe(true);
      expect(response.submissions).toHaveLength(1);
    });
  });

  describe("network support", () => {
    it("supports Base mainnet and rejects other chains", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
        true,
      );
      expect(provider.supportsNetwork({ protocolFamily: "evm", chainId: "8453" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum-mainnet" })).toBe(
        false,
      );
    });
  });
});
