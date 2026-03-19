import { Agora402ActionProvider } from "./agora402ActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { ESCROW_ADDRESSES } from "./constants";

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("Agora402ActionProvider", () => {
  let provider: Agora402ActionProvider;
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  const BASE_SEPOLIA_NETWORK: Network = {
    protocolFamily: "evm",
    networkId: "base-sepolia",
    chainId: "84532",
  };

  const BASE_MAINNET_NETWORK: Network = {
    protocolFamily: "evm",
    networkId: "base-mainnet",
    chainId: "8453",
  };

  const UNSUPPORTED_NETWORK: Network = {
    protocolFamily: "evm",
    networkId: "ethereum-mainnet",
    chainId: "1",
  };

  const SOLANA_NETWORK: Network = {
    protocolFamily: "svm",
    networkId: "solana-mainnet",
  };

  beforeEach(() => {
    provider = new Agora402ActionProvider();
    mockWallet = {
      getAddress: jest.fn().mockReturnValue("0x1234567890abcdef1234567890abcdef12345678"),
      getNetwork: jest.fn().mockReturnValue(BASE_SEPOLIA_NETWORK),
      sendTransaction: jest.fn().mockResolvedValue("0xmocktxhash"),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({
        logs: [
          {
            address: ESCROW_ADDRESSES[84532]!,
            topics: [
              "0xdaaa07e73a11f25fe84ab8e517c7a63b3fed5bac71421cc8f4e41cfd42581f28",
              "0x0000000000000000000000000000000000000000000000000000000000000001",
            ],
          },
        ],
      }),
      readContract: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;
    mockFetch.mockReset();
  });

  describe("supportsNetwork", () => {
    it("should support Base Sepolia", () => {
      expect(provider.supportsNetwork(BASE_SEPOLIA_NETWORK)).toBe(true);
    });

    it("should support Base mainnet", () => {
      expect(provider.supportsNetwork(BASE_MAINNET_NETWORK)).toBe(true);
    });

    it("should not support Ethereum mainnet", () => {
      expect(provider.supportsNetwork(UNSUPPORTED_NETWORK)).toBe(false);
    });

    it("should not support Solana", () => {
      expect(provider.supportsNetwork(SOLANA_NETWORK)).toBe(false);
    });
  });

  describe("createEscrow", () => {
    it("should create an escrow successfully", async () => {
      // Mock allowance check returns 0 (needs approval)
      mockWallet.readContract.mockResolvedValueOnce(0n);

      const result = await provider.createEscrow(mockWallet, {
        seller: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        amount_usdc: 1.0,
        timelock_minutes: 30,
        service_url: "https://api.example.com/data",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.txHash).toBe("0xmocktxhash");
      expect(parsed.amount).toContain("USDC");
      expect(parsed.seller).toBe("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");
      // Should have called sendTransaction twice: approve + createAndFund
      expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(2);
    });

    it("should skip approval when allowance is sufficient", async () => {
      // Mock allowance returns large value
      mockWallet.readContract.mockResolvedValueOnce(BigInt(10_000_000));

      const result = await provider.createEscrow(mockWallet, {
        seller: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        amount_usdc: 1.0,
        timelock_minutes: 30,
        service_url: "https://api.example.com/data",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.approveTxHash).toBe("already approved");
      // Should have called sendTransaction once: only createAndFund
      expect(mockWallet.sendTransaction).toHaveBeenCalledTimes(1);
    });

    it("should return error on failure", async () => {
      mockWallet.readContract.mockRejectedValueOnce(new Error("network error"));

      const result = await provider.createEscrow(mockWallet, {
        seller: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        amount_usdc: 1.0,
        timelock_minutes: 30,
        service_url: "https://api.example.com/data",
      });

      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.details).toContain("network error");
    });
  });

  describe("releaseEscrow", () => {
    it("should release an escrow successfully", async () => {
      const result = await provider.releaseEscrow(mockWallet, {
        escrow_id: "1",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.action).toBe("released");
      expect(parsed.txHash).toBe("0xmocktxhash");
    });
  });

  describe("disputeEscrow", () => {
    it("should dispute an escrow successfully", async () => {
      const result = await provider.disputeEscrow(mockWallet, {
        escrow_id: "1",
        reason: "API returned error 500",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.action).toBe("disputed");
      expect(parsed.reason).toBe("API returned error 500");
      expect(parsed.txHash).toBe("0xmocktxhash");
    });
  });

  describe("checkEscrow", () => {
    it("should return escrow details", async () => {
      mockWallet.readContract.mockResolvedValueOnce([
        "0x1111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222",
        BigInt(1_000_000), // $1.00 USDC
        BigInt(1700000000),
        BigInt(1700001800),
        1, // Funded state
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      ]);

      const result = await provider.checkEscrow(mockWallet, {
        escrow_id: "0",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.state).toBe("Funded");
      expect(parsed.amount).toContain("USDC");
    });
  });

  describe("checkTrustScore", () => {
    it("should return trust score for agent with history", async () => {
      // Mock getScore
      mockWallet.readContract.mockResolvedValueOnce(BigInt(85));
      // Mock getReputation
      mockWallet.readContract.mockResolvedValueOnce([
        BigInt(10), // totalCompleted
        BigInt(1), // totalDisputed
        BigInt(0), // totalRefunded
        BigInt(5), // totalAsProvider
        BigInt(6), // totalAsClient
        BigInt(50_000_000), // totalVolume ($50)
        BigInt(1700000000), // firstSeen
        BigInt(1700001000), // lastSeen
      ]);

      const result = await provider.checkTrustScore(mockWallet, {
        address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.score).toBe(85);
      expect(parsed.recommendation).toBe("high_trust");
      expect(parsed.totalEscrows).toBe(11);
    });

    it("should return low_trust for address with no history", async () => {
      // Mock getScore
      mockWallet.readContract.mockResolvedValueOnce(BigInt(0));
      // Mock getReputation — all zeros
      mockWallet.readContract.mockResolvedValueOnce([
        BigInt(0),
        BigInt(0),
        BigInt(0),
        BigInt(0),
        BigInt(0),
        BigInt(0),
        BigInt(0),
        BigInt(0),
      ]);

      const result = await provider.checkTrustScore(mockWallet, {
        address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.score).toBe(50);
      expect(parsed.recommendation).toBe("low_trust");
    });
  });

  describe("protectedApiCall", () => {
    it("should auto-release when response matches schema", async () => {
      // Mock allowance — sufficient
      mockWallet.readContract.mockResolvedValueOnce(BigInt(10_000_000));

      // Mock API response
      mockFetch.mockResolvedValueOnce({
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ data: "hello", status: "ok" })),
      });

      const result = await provider.protectedApiCall(mockWallet, {
        url: "https://api.example.com/data",
        method: "GET",
        seller_address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        amount_usdc: 0.5,
        timelock_minutes: 30,
        verification_schema: '{"type":"object","required":["data","status"]}',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.action).toBe("auto_released");
      expect(parsed.createTxHash).toBe("0xmocktxhash");
      expect(parsed.releaseTxHash).toBe("0xmocktxhash");
    });

    it("should auto-dispute when response fails schema", async () => {
      // Mock allowance — sufficient
      mockWallet.readContract.mockResolvedValueOnce(BigInt(10_000_000));

      // Mock API response — missing required field
      mockFetch.mockResolvedValueOnce({
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ error: "not found" })),
      });

      const result = await provider.protectedApiCall(mockWallet, {
        url: "https://api.example.com/data",
        method: "GET",
        seller_address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        amount_usdc: 0.5,
        timelock_minutes: 30,
        verification_schema: '{"type":"object","required":["data","status"]}',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.action).toBe("auto_disputed");
      expect(parsed.disputeTxHash).toBe("0xmocktxhash");
    });

    it("should auto-dispute when API call fails", async () => {
      // Mock allowance — sufficient
      mockWallet.readContract.mockResolvedValueOnce(BigInt(10_000_000));

      // Mock fetch failure
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));

      const result = await provider.protectedApiCall(mockWallet, {
        url: "https://api.example.com/data",
        method: "GET",
        seller_address: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        amount_usdc: 0.5,
        timelock_minutes: 30,
        verification_schema: '{"type":"object","required":["data"]}',
      });

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.action).toBe("auto_disputed");
      expect(parsed.error).toContain("ECONNREFUSED");
    });
  });

  describe("custom config", () => {
    it("should use custom addresses when provided", async () => {
      const customProvider = new Agora402ActionProvider({
        escrowAddress: "0xcccccccccccccccccccccccccccccccccccccccc",
        reputationAddress: "0xdddddddddddddddddddddddddddddddddddddd",
        usdcAddress: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      });

      // Mock allowance check
      mockWallet.readContract.mockResolvedValueOnce(BigInt(10_000_000));

      // The sendTransaction should use the custom escrow address
      await customProvider.createEscrow(mockWallet, {
        seller: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        amount_usdc: 1.0,
        timelock_minutes: 30,
        service_url: "test",
      });

      // Verify the allowance check used custom USDC address
      expect(mockWallet.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        }),
      );
    });
  });
});
