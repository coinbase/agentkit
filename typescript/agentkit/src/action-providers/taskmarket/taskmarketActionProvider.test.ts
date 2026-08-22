import { execFile } from "child_process";
import { taskmarketActionProvider } from "./taskmarketActionProvider";

jest.mock("child_process", () => ({ execFile: jest.fn() }));

const execFileMock = execFile as unknown as jest.Mock;

describe("TaskmarketActionProvider", () => {
  const provider = taskmarketActionProvider();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  const cliCall = (stdout: string, stderr = "") =>
    execFileMock.mockImplementation(
      (cmd: string, args: string[], opts: unknown, cb: (e: Error | null, so: string, se: string) => void) =>
        cb(null, stdout, stderr),
    );

  const cliError = (message: string, stderr = "") =>
    execFileMock.mockImplementation(
      (cmd: string, args: string[], opts: unknown, cb: (e: Error | null, so: string, se: string) => void) =>
        cb(new Error(message), "", stderr),
    );

  describe("listTasks", () => {
    it("should invoke the CLI with default filters and return its output", async () => {
      const output = JSON.stringify({ ok: true, data: { tasks: [] } });
      cliCall(output);

      const result = await provider.listTasks({
        status: "open",
        limit: 20,
        rewardMin: null,
        tags: null,
      });

      expect(result).toEqual(output);
      expect(execFileMock).toHaveBeenCalledWith(
        "taskmarket",
        ["task", "list", "--status", "open", "--limit", "20"],
        expect.anything(),
        expect.any(Function),
      );
    });

    it("should pass through reward and tag filters", async () => {
      cliCall("{}");

      await provider.listTasks({ status: "open", limit: 5, rewardMin: 1, tags: "html" });

      expect(execFileMock).toHaveBeenCalledWith(
        "taskmarket",
        ["task", "list", "--status", "open", "--limit", "5", "--reward-min", "1", "--tags", "html"],
        expect.anything(),
        expect.any(Function),
      );
    });

    it("should surface CLI errors with stderr detail", async () => {
      cliError("spawn failed", "CLI not installed");

      const result = await provider.listTasks({ status: "open", limit: 20, rewardMin: null, tags: null });

      expect(result).toContain("Error listing Taskmarket tasks");
      expect(result).toContain("CLI not installed");
    });
  });

  describe("getTask", () => {
    it("should fetch a task by id", async () => {
      const output = JSON.stringify({ ok: true, data: { id: "0xabc" } });
      cliCall(output);

      const result = await provider.getTask({ taskId: "0xabc" });

      expect(result).toEqual(output);
      expect(execFileMock).toHaveBeenCalledWith(
        "taskmarket",
        ["task", "get", "0xabc"],
        expect.anything(),
        expect.any(Function),
      );
    });

    it("should return an error message for unknown tasks", async () => {
      cliError("not found", "Task not found");

      const result = await provider.getTask({ taskId: "0xdead" });

      expect(result).toContain("Error getting Taskmarket task");
      expect(result).toContain("Task not found");
    });
  });

  describe("mySubmissions", () => {
    it("should list the wallet's submissions", async () => {
      const output = JSON.stringify({ ok: true, data: [] });
      cliCall(output);

      const result = await provider.mySubmissions();

      expect(result).toEqual(output);
      expect(execFileMock).toHaveBeenCalledWith(
        "taskmarket",
        ["task", "my-submissions"],
        expect.anything(),
        expect.any(Function),
      );
    });
  });

  describe("submitWork", () => {
    it("should refuse to submit without explicit confirmation", async () => {
      const result = await provider.submitWork({
        taskId: "0xabc",
        filePath: "./index.html",
        role: "final",
        confirm: false,
      });

      expect(result).toContain("not confirmed");
      expect(execFileMock).not.toHaveBeenCalled();
    });

    it("should submit with the file and role when confirmed", async () => {
      const output = JSON.stringify({ ok: true, data: { submissionId: "sub-1" } });
      cliCall(output);

      const result = await provider.submitWork({
        taskId: "0xabc",
        filePath: "./index.html",
        role: "final",
        confirm: true,
      });

      expect(result).toEqual(output);
      expect(execFileMock).toHaveBeenCalledWith(
        "taskmarket",
        ["task", "submit", "0xabc", "--file", "./index.html", "--role", "final"],
        expect.anything(),
        expect.any(Function),
      );
    });
  });

  describe("createTask", () => {
    it("should refuse to create a task without explicit confirmation", async () => {
      const result = await provider.createTask({
        description: "Build a logo",
        rewardUsdc: 5,
        durationHours: 48,
        tags: null,
        confirm: false,
      });

      expect(result).toContain("not confirmed");
      expect(result).toContain("5 USDC");
      expect(execFileMock).not.toHaveBeenCalled();
    });

    it("should escrow and create the task when confirmed", async () => {
      const output = JSON.stringify({ ok: true, data: { id: "0xnew" } });
      cliCall(output);

      const result = await provider.createTask({
        description: "Build a logo",
        rewardUsdc: 5,
        durationHours: 48,
        tags: "design",
        confirm: true,
      });

      expect(result).toEqual(output);
      expect(execFileMock).toHaveBeenCalledWith(
        "taskmarket",
        [
          "task",
          "create",
          "--description",
          "Build a logo",
          "--reward",
          "5",
          "--duration",
          "48",
          "--tags",
          "design",
        ],
        expect.anything(),
        expect.any(Function),
      );
    });
  });

  describe("supportsNetwork", () => {
    it("should always return true", () => {
      expect(provider.supportsNetwork()).toBe(true);
    });
  });
});
