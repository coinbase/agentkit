import { beefyActionProvider, BeefyActionProvider } from "./beefyActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";

const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock("../../utils", () => ({
  approve: jest.fn().mockResolvedValue("Approval successful"),
}));

describe("BeefyActionProvider", () => {
  let provider: BeefyActionProvider;
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    provider = beefyActionProvider();
    mockWallet = {
      getAddress: jest.fn().mockReturnValue("0x1234567890abcdef1234567890abcdef12345678"),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" }),
      sendTransaction: jest.fn().mockResolvedValue("0xmocktxhash" as `0x${string}`),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({ status: 1, blockNumber: 123456 }),
      readContract: jest.fn(),
    } as unknown as jest.Mocked<EvmWalletProvider>;

    mockFetch.mockReset();
  });

  describe("supportsNetwork", () => {
    it("should support base-mainnet", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" }),
      ).toBe(true);
    });

    it("should not support unsupported networks", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum-mainnet" }),
      ).toBe(false);
    });

    it("should not support non-evm", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "svm", networkId: "base-mainnet" }),
      ).toBe(false);
    });
  });

  describe("deposit", () => {
    it("should successfully deposit into vault", async () => {
      // Mock want() -> returns want token address
      mockWallet.readContract
        .mockResolvedValueOnce("0x4200000000000000000000000000000000000006") // want()
        .mockResolvedValueOnce(18); // decimals()

      const result = await provider.deposit(mockWallet, {
        vaultAddress: "0x0A2Bc5Bd33bac3C34551C67Af3657451911518Fa",
        amount: "1.0",
      });

      expect(result).toContain("Successfully deposited");
      expect(result).toContain("0xmocktxhash");
      expect(mockWallet.sendTransaction).toHaveBeenCalled();
    });

    it("should handle errors", async () => {
      mockWallet.readContract.mockRejectedValueOnce(new Error("Contract call failed"));

      const result = await provider.deposit(mockWallet, {
        vaultAddress: "0x0A2Bc5Bd33bac3C34551C67Af3657451911518Fa",
        amount: "1.0",
      });

      expect(result).toContain("Error");
    });
  });

  describe("withdraw", () => {
    it("should withdraw all when no amount specified", async () => {
      const result = await provider.withdraw(mockWallet, {
        vaultAddress: "0x0A2Bc5Bd33bac3C34551C67Af3657451911518Fa",
      });

      expect(result).toContain("Successfully withdrew");
      expect(mockWallet.sendTransaction).toHaveBeenCalled();
    });

    it("should withdraw specific amount", async () => {
      const result = await provider.withdraw(mockWallet, {
        vaultAddress: "0x0A2Bc5Bd33bac3C34551C67Af3657451911518Fa",
        amount: "0.5",
      });

      expect(result).toContain("Successfully withdrew");
    });
  });

  describe("checkPosition", () => {
    it("should return position details", async () => {
      mockWallet.readContract
        .mockResolvedValueOnce(BigInt("1000000000000000000")) // balanceOf (1 moo)
        .mockResolvedValueOnce(BigInt("1050000000000000000")) // getPricePerFullShare (1.05)
        .mockResolvedValueOnce("mooMorpho-WETH"); // symbol

      const result = await provider.checkPosition(mockWallet, {
        vaultAddress: "0x0A2Bc5Bd33bac3C34551C67Af3657451911518Fa",
      });

      expect(result).toContain("Beefy Vault Position");
      expect(result).toContain("mooMorpho-WETH");
      expect(result).toContain("1.05");
    });
  });

  describe("listVaults", () => {
    it("should list active vaults", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              id: "morpho-seamless-weth",
              chain: "base",
              status: "active",
              earnContractAddress: "0xVault1",
              tokenAddress: "0xWant1",
              earnedToken: "mooMorpho-WETH",
              platformId: "morpho",
              assets: ["WETH"],
            },
          ],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ "morpho-seamless-weth": 0.076 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ "morpho-seamless-weth": 5000000 }),
        });

      const result = await provider.listVaults(mockWallet, {});

      expect(result).toContain("Active Beefy Vaults");
      expect(result).toContain("WETH");
      expect(result).toContain("morpho");
    });

    it("should filter by platform", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            { id: "v1", chain: "base", status: "active", earnContractAddress: "0x1", platformId: "morpho", assets: ["WETH"] },
            { id: "v2", chain: "base", status: "active", earnContractAddress: "0x2", platformId: "aerodrome", assets: ["WETH", "USDC"] },
          ],
        })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ v1: 0.05, v2: 0.1 }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const result = await provider.listVaults(mockWallet, { platform: "morpho" });

      expect(result).toContain("WETH");
      expect(result).not.toContain("aerodrome");
    });

    it("should handle no vaults", async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      const result = await provider.listVaults(mockWallet, {});
      expect(result).toContain("No active Beefy vaults");
    });
  });
});
