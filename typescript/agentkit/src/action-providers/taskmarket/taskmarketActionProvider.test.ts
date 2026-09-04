import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { TaskMarketActionProvider, taskMarketActionProvider } from "./taskmarketActionProvider";
import { TaskMarketListTasksSchema, TaskMarketSubmitWorkSchema } from "./schemas";

const BASE_NETWORK: Network = {
  protocolFamily: "evm",
  networkId: "base-mainnet",
  chainId: "8453",
};

const OTHER_NETWORK: Network = {
  protocolFamily: "evm",
  networkId: "ethereum-mainnet",
  chainId: "1",
};

const wallet = {
  getAddress: jest.fn(() => "0x1111111111111111111111111111111111111111"),
  getNetwork: jest.fn(() => BASE_NETWORK),
  signMessage: jest.fn().mockResolvedValue("0xsignature"),
} as unknown as EvmWalletProvider;

describe("TaskMarketActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  beforeEach(() => {
    jest.resetAllMocks();
    wallet.getNetwork = jest.fn(() => BASE_NETWORK);
    wallet.getAddress = jest.fn(() => "0x1111111111111111111111111111111111111111");
    wallet.signMessage = jest.fn().mockResolvedValue("0xsignature");
  });

  it("supports Base mainnet only", () => {
    const provider = taskMarketActionProvider();
    expect(provider.supportsNetwork(BASE_NETWORK)).toBe(true);
    expect(provider.supportsNetwork(OTHER_NETWORK)).toBe(false);
    expect(provider.supportsNetwork({ protocolFamily: "svm" })).toBe(false);
  });

  it("lists open tasks using read-only query parameters", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('{"tasks":[]}'),
    });

    const provider = taskMarketActionProvider({ apiUrl: "https://api.taskmarket.test" });
    const result = await provider.listTasks(wallet, {
      mode: "bounty",
      tags: ["open-source"],
      minReward: "1",
      deadlineHours: 24,
      limit: 10,
    });

    expect(JSON.parse(result)).toEqual({ success: true, data: { tasks: [] } });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.taskmarket.test/api/tasks?status=open&limit=10&sort=deadline_asc&mode=bounty&tags=open-source&minReward=1&deadlineHours=24",
    );
  });

  it("returns a clear error without spending when the API rejects a read", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      text: jest.fn().mockResolvedValue("service unavailable"),
    });

    const provider = taskMarketActionProvider();
    const result = await provider.getTask(wallet, {
      taskId: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });

    expect(JSON.parse(result)).toEqual({
      success: false,
      status: 503,
      error: "service unavailable",
    });
  });

  it("requires an authorization confirmation in the schema", () => {
    const parsed = TaskMarketSubmitWorkSchema.safeParse({
      taskId: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      fileName: "deliverable.md",
      mimeType: "text/markdown",
      content: "final work",
      role: "final",
    });

    expect(parsed.success).toBe(false);
  });

  it("submits a signed text artifact without attempting an automatic payment", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest
          .fn()
          .mockResolvedValue(
            '{"uploadUrl":"https://uploads.taskmarket.test/artifact","artifactKey":"key-1"}',
          ),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('{"submissionId":"sub-1"}'),
      });

    const provider = new TaskMarketActionProvider({ apiUrl: "https://api.taskmarket.test" });
    const taskId = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const result = await provider.submitWork(wallet, {
      taskId,
      fileName: "deliverable.md",
      mimeType: "text/markdown",
      content: "final work",
      role: "final",
      confirmation: "User authorized submission for task " + taskId,
    });

    expect(JSON.parse(result)).toEqual({
      success: true,
      workerAddress: "0x1111111111111111111111111111111111111111",
      submission: { submissionId: "sub-1" },
    });
    expect(wallet.signMessage).toHaveBeenNthCalledWith(1, `taskmarket:submit:${taskId}`);
    expect(wallet.signMessage).toHaveBeenNthCalledWith(2, `taskmarket:submit:${taskId}:key-1`);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `https://api.taskmarket.test/api/tasks/${taskId}/submissions/request-upload-url`,
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
      }),
    );

    expect(fetchMock.mock.calls[1][0].toString()).toBe("https://uploads.taskmarket.test/artifact");
    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({ method: "PUT", body: Buffer.from("final work", "utf8") }),
    );

    const request = fetchMock.mock.calls[2][1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.workerAddress).toBe("0x1111111111111111111111111111111111111111");
    expect(body.signature).toBe("0xsignature");
    expect(body.artifacts[0]).toMatchObject({
      artifactKey: "key-1",
      fileName: "deliverable.md",
      mimeType: "text/markdown",
      role: "final",
      sizeBytes: 10,
    });
    expect(body.artifacts[0].sha256Hash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.artifacts[0].keccak256Hash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(request.headers).toMatchObject({
      "X-Taskmarket-Idempotency-Key": expect.any(String),
    });
  });

  it("does not expose taskmarket actions on another network", async () => {
    wallet.getNetwork = jest.fn(() => OTHER_NETWORK);
    const provider = taskMarketActionProvider();
    const result = await provider.listTasks(wallet, {
      mode: "bounty",
      tags: [],
      minReward: undefined,
      deadlineHours: undefined,
      limit: 20,
    });

    expect(JSON.parse(result).error).toContain("Base mainnet");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("defaults list schema filters safely", () => {
    const parsed = TaskMarketListTasksSchema.parse({});
    expect(parsed).toEqual({
      mode: "bounty",
      tags: [],
      minReward: undefined,
      deadlineHours: undefined,
      limit: 20,
    });
  });
});
