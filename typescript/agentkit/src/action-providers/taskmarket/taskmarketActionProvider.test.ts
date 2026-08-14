import { TaskMarketActionProvider } from "./taskmarketActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";

jest.mock("../../wallet-providers", () => {
  /** Minimal wallet-provider base for the isolated provider tests. */
  class WalletProvider {}

  /** Minimal EVM wallet provider for the isolated provider tests. */
  class EvmWalletProvider extends WalletProvider {}
  return { WalletProvider, EvmWalletProvider };
});

const mockResponse = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  }) as Response;

const mockWallet = {
  getAddress: () => "0x1111111111111111111111111111111111111111",
  getName: () => "test-wallet",
  getNetwork: () => ({ protocolFamily: "evm", networkId: "base-mainnet", chainId: "8453" }),
  toSigner: () => ({
    address: "0x1111111111111111111111111111111111111111",
    sign: jest.fn(),
    signMessage: jest.fn(),
    signTransaction: jest.fn(),
    signTypedData: jest.fn(),
  }),
  readContract: jest.fn(),
  signMessage: jest.fn(async (message: string) => `signature:${message}`),
} as unknown as jest.Mocked<EvmWalletProvider>;

describe("TaskMarketActionProvider", () => {
  beforeEach(() => {
    mockWallet.signMessage.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("rejects an invalid x402 payment cap", () => {
    expect(() => new TaskMarketActionProvider({ maxPaymentUsdc: -1 })).toThrow(
      "maxPaymentUsdc must be a non-negative finite number",
    );
  });

  it("lists tasks through the public API", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(mockResponse({ tasks: [{ id: "task-1" }], hasMore: false }));
    const provider = new TaskMarketActionProvider({ apiUrl: "https://taskmarket.test" });

    const result = await provider.listTasks({ status: "open", limit: 5 });

    expect(result).toContain('"task-1"');
    expect(fetchMock).toHaveBeenCalledWith(
      "https://taskmarket.test/api/tasks?status=open&limit=5",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("requires explicit confirmation before creating a funded task", async () => {
    const provider = new TaskMarketActionProvider({
      apiUrl: "https://taskmarket.test",
      allowWriteActions: true,
      maxPaymentUsdc: 1,
    });

    await expect(
      provider.createTask(mockWallet, {
        description: "Ship a tested integration",
        deliverables: ["Public pull request"],
        rewardUsdc: 0.5,
        deadlineIso: new Date(Date.now() + 3_600_000).toISOString(),
        network: "base-mainnet",
        maxSpendUsdc: 0.5,
        confirmed: false as never,
      }),
    ).rejects.toThrow("fresh explicit confirmation");
  });

  it("creates a confirmed task with the requested guardrails", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(mockResponse({ taskId: "task-created" }));
    const provider = new TaskMarketActionProvider({
      apiUrl: "https://taskmarket.test",
      allowWriteActions: true,
      maxPaymentUsdc: 1,
    });

    const result = await provider.createTask(mockWallet, {
      description: "Ship a tested integration",
      deliverables: ["Public pull request", "Reproduction logs"],
      rewardUsdc: 0.5,
      deadlineIso: new Date(Date.now() + 3_600_000).toISOString(),
      network: "base-mainnet",
      maxSpendUsdc: 0.5,
      confirmed: true,
      tags: ["integration"],
    });

    expect(result).toContain("task-created");
    const [input, init] = fetchMock.mock.calls[0] ?? [];
    const serializedBody =
      init?.body ?? (input instanceof Request ? await input.clone().text() : undefined);
    const body = JSON.parse(String(serializedBody));
    expect(body.reward).toBe("500000");
    expect(body.description).toContain("Settlement network: Base mainnet (eip155:8453)");
    expect(body.description).toContain("Maximum authorized spend: 0.5 USDC");
    expect(body.description).toContain("- Public pull request");
  });

  it("keeps wallet writes disabled by default", async () => {
    const provider = new TaskMarketActionProvider({ apiUrl: "https://taskmarket.test" });

    await expect(provider.claimTask(mockWallet, { taskId: "0xabc" })).rejects.toThrow(
      "write actions are disabled",
    );
    expect(mockWallet.signMessage).not.toHaveBeenCalled();
  });

  it("claims only after writes are explicitly enabled", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(mockResponse({ claimId: "claim-1" }));
    const provider = new TaskMarketActionProvider({
      apiUrl: "https://taskmarket.test",
      allowWriteActions: true,
    });

    const result = await provider.claimTask(mockWallet, { taskId: "0xabc" });

    expect(result).toContain("claim-1");
    expect(mockWallet.signMessage).toHaveBeenCalledWith("taskmarket:claim:0xabc");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://taskmarket.test/api/tasks/0xabc/claim",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("retrieves task submissions with read authentication", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValue(mockResponse({ submissions: [{ id: "submission-1" }] }));
    const provider = new TaskMarketActionProvider({ apiUrl: "https://taskmarket.test" });

    const result = await provider.taskSubmissions(mockWallet, { taskId: "0xabc" });

    expect(result).toContain("submission-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://taskmarket.test/api/tasks/0xabc/submissions",
      expect.objectContaining({ method: "GET" }),
    );
    expect(mockWallet.signMessage).toHaveBeenCalledWith(
      "taskmarket:read:0x1111111111111111111111111111111111111111",
    );
  });

  it("uploads and submits one explicit text artifact", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        mockResponse({ uploadUrl: "https://upload.test/artifact", artifactKey: "key-1" }),
      )
      .mockResolvedValueOnce(mockResponse(null))
      .mockResolvedValueOnce(mockResponse({ submissionId: "submission-1" }));
    const provider = new TaskMarketActionProvider({
      apiUrl: "https://taskmarket.test",
      allowWriteActions: true,
    });

    const result = await provider.submitText(mockWallet, {
      taskId: "0xabc",
      fileName: "answer.txt",
      content: "hello TaskMarket",
      mimeType: "text/plain",
      role: "final",
    });

    expect(result).toContain("submission-1");
    expect(mockWallet.signMessage).toHaveBeenCalledWith("taskmarket:submit:0xabc");
    expect(mockWallet.signMessage).toHaveBeenCalledWith("taskmarket:submit:0xabc:key-1");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
