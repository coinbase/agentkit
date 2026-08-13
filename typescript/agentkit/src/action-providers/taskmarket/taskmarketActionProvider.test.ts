jest.mock("../../wallet-providers", () => {
  class WalletProvider {}
  class EvmWalletProvider extends WalletProvider {}
  return { WalletProvider, EvmWalletProvider };
});

import { TaskMarketActionProvider } from "./taskmarketActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";

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
  signMessage: jest.fn(async (message: string) => `signature:${message}`),
} as unknown as jest.Mocked<EvmWalletProvider>;

describe("TaskMarketActionProvider", () => {
  afterEach(() => {
    jest.restoreAllMocks();
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

  it("keeps wallet writes disabled by default", async () => {
    const provider = new TaskMarketActionProvider({ apiUrl: "https://taskmarket.test" });

    await expect(
      provider.claimTask(mockWallet, { taskId: "0xabc" }),
    ).rejects.toThrow("write actions are disabled");
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

  it("uploads and submits one explicit text artifact", async () => {
    const fetchMock = jest
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(mockResponse({ uploadUrl: "https://upload.test/artifact", artifactKey: "key-1" }))
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

