import { SpraayActionProvider } from "../spraayActionProvider";
import { EvmWalletProvider } from "@coinbase/agentkit";
import { SPRAAY_CONTRACT_ADDRESS } from "../constants";

// Mock the wallet provider
const mockSendTransaction = jest.fn();
const mockWaitForTransactionReceipt = jest.fn();
const mockGetAddress = jest.fn();
const mockReadContract = jest.fn();

const mockWalletProvider = {
  sendTransaction: mockSendTransaction,
  waitForTransactionReceipt: mockWaitForTransactionReceipt,
  getAddress: mockGetAddress,
  readContract: mockReadContract,
  getNetwork: jest.fn().mockReturnValue({
    protocolFamily: "evm",
    networkId: "base-mainnet",
  }),
} as unknown as EvmWalletProvider;

describe("SpraayActionProvider", () => {
  let provider: SpraayActionProvider;

  beforeEach(() => {
    provider = new SpraayActionProvider();
    jest.clearAllMocks();

    mockGetAddress.mockResolvedValue("0x1234567890123456789012345678901234567890");
    mockSendTransaction.mockResolvedValue("0xmocktxhash123");
    mockWaitForTransactionReceipt.mockResolvedValue({ blockNumber: 12345n });
  });

  describe("supportsNetwork", () => {
    it("should support Base mainnet", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })
      ).toBe(true);
    });

    it("should not support other networks", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum-mainnet" })
      ).toBe(false);
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" })
      ).toBe(false);
      expect(
        provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })
      ).toBe(false);
    });
  });

  describe("sprayEth", () => {
    it("should spray ETH to multiple recipients", async () => {
      const result = await provider.sprayEth(mockWalletProvider, {
        recipients: [
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        ],
        amountPerRecipient: "0.01",
      });

      expect(mockSendTransaction).toHaveBeenCalledTimes(1);
      expect(mockWaitForTransactionReceipt).toHaveBeenCalledWith("0xmocktxhash123");
      expect(result).toContain("Successfully sprayed");
      expect(result).toContain("2 recipients");
      expect(result).toContain("0xmocktxhash123");
      expect(result).toContain("basescan.org");
    });

    it("should include protocol fee in the total value", async () => {
      await provider.sprayEth(mockWalletProvider, {
        recipients: ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
        amountPerRecipient: "1",
      });

      const callArgs = mockSendTransaction.mock.calls[0][0];
      expect(callArgs.to).toBe(SPRAAY_CONTRACT_ADDRESS);
      // Value should be 1 ETH + 0.3% fee = 1.003 ETH in wei
      expect(callArgs.value).toBeDefined();
    });

    it("should return error message on failure", async () => {
      mockSendTransaction.mockRejectedValue(new Error("Insufficient funds"));

      const result = await provider.sprayEth(mockWalletProvider, {
        recipients: ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
        amountPerRecipient: "100",
      });

      expect(result).toContain("Error spraying ETH");
      expect(result).toContain("Insufficient funds");
    });
  });

  describe("sprayToken", () => {
    beforeEach(() => {
      mockReadContract.mockImplementation((_addr: string, _abi: any, method: string) => {
        if (method === "decimals") return 6; // USDC-like
        if (method === "symbol") return "USDC";
        if (method === "allowance") return BigInt(0);
        return null;
      });
    });

    it("should spray tokens and handle approval", async () => {
      const result = await provider.sprayToken(mockWalletProvider, {
        tokenAddress: "0xcccccccccccccccccccccccccccccccccccccccc",
        recipients: [
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        ],
        amountPerRecipient: "100",
      });

      // Should have sent 2 transactions: approve + spray
      expect(mockSendTransaction).toHaveBeenCalledTimes(2);
      expect(result).toContain("Successfully sprayed");
      expect(result).toContain("USDC");
      expect(result).toContain("2 recipients");
      expect(result).toContain("Token approval granted");
    });

    it("should skip approval if allowance is sufficient", async () => {
      mockReadContract.mockImplementation((_addr: string, _abi: any, method: string) => {
        if (method === "decimals") return 6;
        if (method === "symbol") return "USDC";
        if (method === "allowance") return BigInt("1000000000000"); // Large allowance
        return null;
      });

      const result = await provider.sprayToken(mockWalletProvider, {
        tokenAddress: "0xcccccccccccccccccccccccccccccccccccccccc",
        recipients: ["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
        amountPerRecipient: "10",
      });

      // Should only send 1 transaction (spray, no approve needed)
      expect(mockSendTransaction).toHaveBeenCalledTimes(1);
      expect(result).not.toContain("Token approval granted");
    });
  });

  describe("sprayEthVariable", () => {
    it("should spray variable ETH amounts", async () => {
      const result = await provider.sprayEthVariable(mockWalletProvider, {
        recipients: [
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        ],
        amounts: ["0.01", "0.05"],
      });

      expect(mockSendTransaction).toHaveBeenCalledTimes(1);
      expect(result).toContain("Successfully sprayed variable ETH");
      expect(result).toContain("2 recipients");
    });

    it("should reject mismatched arrays", async () => {
      const result = await provider.sprayEthVariable(mockWalletProvider, {
        recipients: [
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        ],
        amounts: ["0.01"],
      });

      expect(result).toContain("Error: recipients array length");
      expect(mockSendTransaction).not.toHaveBeenCalled();
    });
  });

  describe("sprayTokenVariable", () => {
    beforeEach(() => {
      mockReadContract.mockImplementation((_addr: string, _abi: any, method: string) => {
        if (method === "decimals") return 18;
        if (method === "symbol") return "DAI";
        if (method === "allowance") return BigInt(0);
        return null;
      });
    });

    it("should spray variable token amounts", async () => {
      const result = await provider.sprayTokenVariable(mockWalletProvider, {
        tokenAddress: "0xcccccccccccccccccccccccccccccccccccccccc",
        recipients: [
          "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        ],
        amounts: ["100", "200"],
      });

      expect(mockSendTransaction).toHaveBeenCalledTimes(2); // approve + spray
      expect(result).toContain("Successfully sprayed variable DAI");
      expect(result).toContain("2 recipients");
    });
  });
});
