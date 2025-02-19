import { Connection, PublicKey } from "@solana/web3.js";
import { SvmWalletProvider } from "../../wallet-providers/svmWalletProvider";
import { JupiterActionProvider } from "./jupiterActionProvider";
import { createJupiterApiClient } from "@jup-ag/api";

jest.mock("@solana/web3.js", () => ({
  ...jest.requireActual("@solana/web3.js"),
  Connection: jest.fn(),
  VersionedTransaction: {
    deserialize: jest.fn().mockReturnValue({
      sign: jest.fn(),
    }),
  },
  MessageV0: {
    compile: jest.fn().mockReturnValue({}),
  },
}));

jest.mock("@jup-ag/api", () => ({
  createJupiterApiClient: jest.fn().mockReturnValue({
    quoteGet: jest.fn(),
    swapPost: jest.fn(),
  }),
}));

jest.mock("../../wallet-providers/svmWalletProvider");

describe("JupiterActionProvider", () => {
  let actionProvider;
  let mockWallet;
  let mockConnection;
  let mockJupiterApi;
  let mockQuoteGet;
  let mockSwapPost;

  beforeEach(() => {
    jest.clearAllMocks();

    mockJupiterApi = createJupiterApiClient();
    mockQuoteGet = mockJupiterApi.quoteGet;
    mockSwapPost = mockJupiterApi.swapPost;

    actionProvider = new JupiterActionProvider();
    mockConnection = {
      getLatestBlockhash: jest.fn().mockResolvedValue({ blockhash: "mockedBlockhash" }),
    } as unknown as jest.Mocked<Connection>;

    mockWallet = {
      getConnection: jest.fn().mockReturnValue(mockConnection),
      getPublicKey: jest.fn().mockReturnValue(new PublicKey("11111111111111111111111111111111")),
      signAndSendTransaction: jest.fn().mockResolvedValue("mock-signature"),
      waitForSignatureResult: jest.fn().mockResolvedValue({
        context: { slot: 1234 },
        value: { err: null },
      }),
      getAddress: jest.fn().mockReturnValue("11111111111111111111111111111111"),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "svm", networkId: "solana-mainnet" }),
      getName: jest.fn().mockReturnValue("mock-wallet"),
      getBalance: jest.fn().mockResolvedValue(BigInt(1000000000)),
      nativeTransfer: jest.fn(),
    } as unknown as jest.Mocked<SvmWalletProvider>;
  });

  describe("swap", () => {
    const INPUT_MINT = "So11111111111111111111111111111111111111112";
    const OUTPUT_MINT = "BXXkv6FbfHZmKbMmy6KvaakKt6bYjhbjmhvJ92kp92Mw";
    const MOCK_SIGNATURE = "mock-signature";

    const swapArgs = {
      inputMint: INPUT_MINT,
      outputMint: OUTPUT_MINT,
      amount: 1000000,
      slippageBps: 50,
    };

    it("should successfully swap tokens", async () => {
      mockQuoteGet.mockResolvedValue({ route: "mock-route" });
      mockSwapPost.mockResolvedValue({ swapTransaction: Buffer.from("mock-transaction").toString("base64") });

      const result = await actionProvider.swap(mockWallet, swapArgs);

      expect(mockQuoteGet).toHaveBeenCalledWith({
        inputMint: INPUT_MINT,
        outputMint: OUTPUT_MINT,
        amount: swapArgs.amount,
        slippageBps: swapArgs.slippageBps,
      });

      expect(mockSwapPost).toHaveBeenCalled();
      expect(mockWallet.waitForSignatureResult).toHaveBeenCalledWith(MOCK_SIGNATURE);
      expect(result).toContain("Successfully swapped");
    });

    it("should handle swap quote errors", async () => {
      mockQuoteGet.mockRejectedValue(new Error("Quote error"));

      const result = await actionProvider.swap(mockWallet, swapArgs);
      expect(result).toBe("Error swapping tokens: Error: Quote error");
    });

    it("should handle swap transaction errors", async () => {
      mockQuoteGet.mockResolvedValue({ route: "mock-route" });
      mockSwapPost.mockRejectedValue(new Error("Swap transaction error"));

      const result = await actionProvider.swap(mockWallet, swapArgs);
      expect(result).toBe("Error swapping tokens: Error: Swap transaction error");
    });
  });
});
