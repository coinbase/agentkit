import { atvActionProvider, AtvActionProvider } from "./atvActionProvider";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("AtvActionProvider", () => {
  let provider: AtvActionProvider;

  beforeEach(() => {
    provider = new AtvActionProvider("test-api-key");
    mockFetch.mockReset();
  });

  describe("constructor", () => {
    it("should create provider with default base URL", () => {
      expect(provider).toBeInstanceOf(AtvActionProvider);
    });

    it("should create provider with custom base URL", () => {
      const custom = new AtvActionProvider("key", "https://custom.api.com");
      expect(custom).toBeInstanceOf(AtvActionProvider);
    });
  });

  describe("factory function", () => {
    it("should create provider via factory", () => {
      const p = atvActionProvider("test-key");
      expect(p).toBeInstanceOf(AtvActionProvider);
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for all networks", () => {
      expect(provider.supportsNetwork()).toBe(true);
    });
  });

  describe("listVaults", () => {
    it("should list vaults successfully", async () => {
      const mockVaults = [{ address: "0x123", chain: "ethereum" }];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockVaults,
      });

      const result = await provider.listVaults({});
      expect(result).toContain("0x123");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/vaults"),
        expect.objectContaining({
          headers: { "x-api-key": "test-api-key" },
        }),
      );
    });

    it("should pass chain filter", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await provider.listVaults({ chain: "base" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("chain=base"),
        expect.any(Object),
      );
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });

      const result = await provider.listVaults({});
      expect(result).toContain("Error calling ATV API");
    });
  });

  describe("getVaultNav", () => {
    it("should fetch NAV for a vault", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ nav: "1.05" }),
      });

      const result = await provider.getVaultNav({ address: "0xABC" });
      expect(result).toContain("1.05");
    });
  });

  describe("getVaultTvl", () => {
    it("should fetch TVL for a vault", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tvl: "5000000" }),
      });

      const result = await provider.getVaultTvl({ address: "0xABC" });
      expect(result).toContain("5000000");
    });
  });

  describe("getVaultApy", () => {
    it("should fetch APY for a vault", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ baseApy: "8.5", totalApy: "10.2" }),
      });

      const result = await provider.getVaultApy({ address: "0xABC" });
      expect(result).toContain("10.2");
    });
  });

  describe("buildDepositTx", () => {
    it("should build deposit transaction", async () => {
      const mockTx = { steps: [{ type: "approve" }, { type: "deposit" }] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTx,
      });

      const result = await provider.buildDepositTx({
        userAddress: "0xUser",
        vaultAddress: "0xVault",
        depositTokenAddress: "0xToken",
        depositAmount: "100",
      });
      expect(result).toContain("approve");
      expect(result).toContain("deposit");
    });
  });

  describe("buildWithdrawTx", () => {
    it("should build withdraw transaction", async () => {
      const mockTx = { steps: [{ type: "withdraw" }] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTx,
      });

      const result = await provider.buildWithdrawTx({
        userAddress: "0xUser",
        vaultAddress: "0xVault",
        oTokenAddress: "0xToken",
        sharesToWithdraw: "50",
      });
      expect(result).toContain("withdraw");
    });

    it("should include slippage when provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await provider.buildWithdrawTx({
        userAddress: "0xUser",
        vaultAddress: "0xVault",
        oTokenAddress: "0xToken",
        sharesToWithdraw: "50",
        slippage: "0.5",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("slippage=0.5"),
        expect.any(Object),
      );
    });
  });
});
