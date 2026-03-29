import { pendleActionProvider, PendleActionProvider } from "./pendleActionProvider";
import { EvmWalletProvider } from "../../wallet-providers";

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock approve utility
jest.mock("../../utils", () => ({
  approve: jest.fn().mockResolvedValue("Approval successful"),
}));

describe("PendleActionProvider", () => {
  let provider: PendleActionProvider;
  let mockWallet: jest.Mocked<EvmWalletProvider>;

  beforeEach(() => {
    provider = pendleActionProvider();
    mockWallet = {
      getAddress: jest.fn().mockReturnValue("0x1234567890abcdef1234567890abcdef12345678"),
      getNetwork: jest.fn().mockReturnValue({ protocolFamily: "evm", networkId: "base-mainnet" }),
      sendTransaction: jest.fn().mockResolvedValue("0xmocktxhash" as `0x${string}`),
      waitForTransactionReceipt: jest.fn().mockResolvedValue({ status: 1, blockNumber: 123456 }),
      readContract: jest.fn().mockResolvedValue(18),
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

    it("should not support non-evm networks", () => {
      expect(
        provider.supportsNetwork({ protocolFamily: "svm", networkId: "base-mainnet" }),
      ).toBe(false);
    });
  });

  describe("buyPt", () => {
    it("should successfully buy PT", async () => {
      // Mock market info fetch
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            pt: "0xPtAddress0000000000000000000000000000000",
            yt: "0xYtAddress0000000000000000000000000000000",
            sy: "0xSyAddress0000000000000000000000000000000",
          }),
        })
        // Mock convert API
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tx: { to: "0xRouterAddress", data: "0xcalldata", value: "0" },
            requiredApprovals: [],
          }),
        });

      const result = await provider.buyPt(mockWallet, {
        market: "0x829a0d0b0261a3b96208631c19d5380422e2ca54",
        tokenIn: "0x4200000000000000000000000000000000000006",
        amount: "0.1",
        slippage: 0.01,
      });

      expect(result).toContain("Successfully bought PT");
      expect(result).toContain("0xmocktxhash");
      expect(mockWallet.sendTransaction).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Bad request",
      });

      const result = await provider.buyPt(mockWallet, {
        market: "0x829a0d0b0261a3b96208631c19d5380422e2ca54",
        tokenIn: "0x4200000000000000000000000000000000000006",
        amount: "0.1",
        slippage: 0.01,
      });

      expect(result).toContain("Error");
    });
  });

  describe("sellPt", () => {
    it("should successfully sell PT", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            pt: "0xPtAddress0000000000000000000000000000000",
            yt: "0xYtAddress0000000000000000000000000000000",
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tx: { to: "0xRouterAddress", data: "0xcalldata", value: "0" },
            requiredApprovals: [],
          }),
        });

      const result = await provider.sellPt(mockWallet, {
        market: "0x829a0d0b0261a3b96208631c19d5380422e2ca54",
        tokenOut: "0x4200000000000000000000000000000000000006",
        amount: "1.0",
        slippage: 0.01,
      });

      expect(result).toContain("Successfully sold PT");
    });
  });

  describe("addLiquidity", () => {
    it("should successfully add liquidity", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tx: { to: "0xRouterAddress", data: "0xcalldata", value: "100000000000000" },
          requiredApprovals: [],
        }),
      });

      const result = await provider.addLiquidity(mockWallet, {
        market: "0x829a0d0b0261a3b96208631c19d5380422e2ca54",
        tokenIn: "0x0000000000000000000000000000000000000000",
        amount: "0.1",
        slippage: 0.01,
      });

      expect(result).toContain("Successfully added liquidity");
    });
  });

  describe("claimRewards", () => {
    it("should successfully claim rewards", async () => {
      const result = await provider.claimRewards(mockWallet, {
        syAddresses: [],
        ytAddresses: ["0x829a0d0b0261a3b96208631c19d5380422e2ca54"],
        marketAddresses: [],
      });

      expect(result).toContain("Successfully claimed Pendle rewards");
      expect(mockWallet.sendTransaction).toHaveBeenCalled();
    });
  });

  describe("listMarkets", () => {
    it("should list active markets", async () => {
      const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            {
              address: "0xMarket1",
              name: "yoETH-Dec2026",
              expiry: futureDate,
              pt: { address: "0xPt1" },
              yt: { address: "0xYt1" },
              underlyingAsset: { symbol: "ETH", address: "0xUnderlying1" },
              impliedApy: 0.0568,
              tvl: { usd: 956000 },
            },
          ],
        }),
      });

      const result = await provider.listMarkets(mockWallet);

      expect(result).toContain("Active Pendle Markets");
      expect(result).toContain("yoETH-Dec2026");
      expect(result).toContain("5.68%");
    });

    it("should handle empty markets", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      const result = await provider.listMarkets(mockWallet);
      expect(result).toContain("No active Pendle markets");
    });
  });
});
