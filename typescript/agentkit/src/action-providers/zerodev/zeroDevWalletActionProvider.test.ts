import { ZeroDevWalletProvider } from "../../wallet-providers";
import { ZeroDevWalletActionProvider } from "./zeroDevWalletActionProvider";
import { GetCABSchema } from "./schemas";
import { type GetCABResult } from "@zerodev/intent";

describe("ZeroDev Wallet Action Provider Input Schemas", () => {
  describe("Get CAB Schema", () => {
    it("should successfully parse valid input with network type", () => {
      const validInput = {
        type: "networkType" as const,
        tokenTickers: ["ETH", "USDC"],
        networkType: "mainnet" as const,
      };

      const result = GetCABSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should successfully parse valid input with network filter", () => {
      const validInput = {
        type: "networkFilter" as const,
        tokenTickers: ["ETH", "USDC"],
        networks: [1, 8453], // ethereum and base network IDs
      };

      const result = GetCABSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should successfully parse input with optional tokenTickers omitted", () => {
      const validInput = {
        type: "networkType" as const,
        networkType: "mainnet" as const,
      };

      const result = GetCABSchema.safeParse(validInput);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validInput);
    });

    it("should fail parsing empty input", () => {
      const emptyInput = {};
      const result = GetCABSchema.safeParse(emptyInput);

      expect(result.success).toBe(false);
    });
  });
});

describe("ZeroDev Wallet Action Provider", () => {
  let actionProvider: ZeroDevWalletActionProvider;
  let mockWallet: jest.Mocked<ZeroDevWalletProvider>;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    actionProvider = new ZeroDevWalletActionProvider();
    mockWallet = {
      getCAB: jest.fn(),
      getAddress: jest.fn().mockReturnValue("0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83"),
      getNetwork: jest.fn().mockReturnValue({ networkId: "ethereum-mainnet" }),
    } as unknown as jest.Mocked<ZeroDevWalletProvider>;
  });

  describe("getCAB", () => {
    const MOCK_BALANCES = {
      balance: BigInt(1000000000000000000),
      tokenAddress: "0x1234567890123456789012345678901234567890" as `0x${string}`,
      tokens: {
        ETH: {
          ethereum: "1.5",
          base: "0.5",
        },
        USDC: {
          ethereum: "1000",
          base: "500",
        },
      },
    } as unknown as GetCABResult;

    beforeEach(() => {
      mockWallet.getCAB.mockResolvedValue(MOCK_BALANCES);
    });

    it("should successfully get chain abstracted balances with network type", async () => {
      const args = {
        type: "networkType" as const,
        tokenTickers: ["ETH", "USDC"],
        networkType: "mainnet" as const,
      };

      const result = await actionProvider.getCAB(mockWallet, args);

      expect(mockWallet.getCAB).toHaveBeenCalledWith(args);
      expect(result).toEqual(MOCK_BALANCES);
    });

    it("should successfully get chain abstracted balances with network filter", async () => {
      const args = {
        type: "networkFilter" as const,
        tokenTickers: ["ETH", "USDC"],
        networks: [1, 8453], // ethereum and base network IDs
      };

      const result = await actionProvider.getCAB(mockWallet, args);

      expect(mockWallet.getCAB).toHaveBeenCalledWith(args);
      expect(result).toEqual(MOCK_BALANCES);
    });

    it("should handle errors when getting balances", async () => {
      const args = {
        type: "networkType" as const,
        networkType: "mainnet" as const,
      };

      const error = new Error("Failed to get balances");
      mockWallet.getCAB.mockRejectedValue(error);

      await expect(actionProvider.getCAB(mockWallet, args)).rejects.toThrow(error);
    });
  });

  describe("supportsNetwork", () => {
    it("should return true when protocolFamily is evm", () => {
      expect(actionProvider.supportsNetwork({ protocolFamily: "evm" })).toBe(true);
    });

    it("should return false when protocolFamily is not evm", () => {
      expect(actionProvider.supportsNetwork({ protocolFamily: "solana" })).toBe(false);
    });
  });
});
