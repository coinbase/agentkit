import { OfframpActionProvider } from "./offrampActionProvider";
import { Network } from "../../network";
import { CashoutActionSchema } from "./schemas";
import { EvmWalletProvider } from "../../wallet-providers";

const mockCashout = jest.fn();

jest.mock("@usdctofiat/offramp", () => ({
  cashout: (...args: unknown[]) => mockCashout(...args),
}));

jest.mock("viem", () => {
  const actual = jest.requireActual("viem");
  return {
    ...actual,
    createWalletClient: jest.fn(() => ({ mocked: true })),
  };
});

describe("OfframpActionProvider", () => {
  const provider = new OfframpActionProvider();
  let mockWalletProvider: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    mockCashout.mockReset();
    mockCashout.mockResolvedValue({
      mode: "fast",
      depositId: "1",
    });
    mockWalletProvider = {
      getAddress: jest.fn().mockReturnValue("0x123"),
      getNetwork: jest.fn().mockReturnValue({
        protocolFamily: "evm",
        networkId: "base-mainnet",
        chainId: "8453",
      }),
      toSigner: jest.fn().mockReturnValue({ address: "0x123" }),
      toEip1193Provider: jest.fn().mockReturnValue({ request: jest.fn() }),
    } as unknown as jest.Mocked<EvmWalletProvider>;
  });

  describe("network support", () => {
    it("should support Base mainnet", () => {
      expect(
        provider.supportsNetwork({
          networkId: "base-mainnet",
          protocolFamily: "evm",
        }),
      ).toBe(true);
    });

    it("should not support Base testnet", () => {
      expect(
        provider.supportsNetwork({
          networkId: "base-sepolia",
          protocolFamily: "evm",
        }),
      ).toBe(false);
    });

    it("should not support other protocol families", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "other-protocol-family",
        }),
      ).toBe(false);
    });

    it("should handle invalid network objects", () => {
      expect(provider.supportsNetwork({} as Network)).toBe(false);
    });
  });

  describe("action validation", () => {
    it("should accept fast and best cashout input", () => {
      const base = {
        amount: "100",
        currency: "EUR",
        platform: "revolut",
        payee: "alice",
      };
      expect(CashoutActionSchema.safeParse({ ...base, mode: "fast" }).success).toBe(true);
      expect(CashoutActionSchema.safeParse({ ...base, mode: "best" }).success).toBe(true);
    });

    it("should reject a missing mode", () => {
      const parseResult = CashoutActionSchema.safeParse({
        amount: "100",
        currency: "EUR",
        platform: "revolut",
        payee: "alice",
      });
      expect(parseResult.success).toBe(false);
    });
  });

  describe("cashout", () => {
    it("should wrap cashout in fast mode", async () => {
      const result = await provider.cashout(mockWalletProvider, {
        mode: "fast",
        amount: "100",
        currency: "EUR",
        platform: "revolut",
        payee: "alice",
      });

      expect(mockCashout).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "fast",
          amount: "100",
          currency: "EUR",
          platform: "revolut",
          payee: "alice",
        }),
      );
      expect(JSON.parse(result)).toEqual({ mode: "fast", depositId: "1" });
    });

    it("should wrap cashout in best mode without forcing Delegate on fast", async () => {
      mockCashout.mockResolvedValue({ mode: "best", depositId: "2" });
      const result = await provider.cashout(mockWalletProvider, {
        mode: "best",
        amount: "50",
        currency: "USD",
        platform: "venmo",
        payee: "bob",
      });
      expect(mockCashout).toHaveBeenCalledWith(expect.objectContaining({ mode: "best" }));
      expect(JSON.parse(result).mode).toBe("best");
    });

    it("should throw when network ID is not set", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: undefined,
      });
      await expect(
        provider.cashout(mockWalletProvider, {
          mode: "fast",
          amount: "100",
          currency: "EUR",
          platform: "revolut",
          payee: "alice",
        }),
      ).rejects.toThrow("Network ID is not set");
      expect(mockCashout).not.toHaveBeenCalled();
    });

    it("should throw for unsupported networks", async () => {
      mockWalletProvider.getNetwork.mockReturnValue({
        protocolFamily: "evm",
        networkId: "ethereum-mainnet",
      });
      await expect(
        provider.cashout(mockWalletProvider, {
          mode: "fast",
          amount: "100",
          currency: "EUR",
          platform: "revolut",
          payee: "alice",
        }),
      ).rejects.toThrow("Base mainnet only");
      expect(mockCashout).not.toHaveBeenCalled();
    });
  });
});
