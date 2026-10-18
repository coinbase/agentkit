import { triqeeActionProvider, TriqeeActionProvider } from "./triqeeActionProvider";

describe("TriqeeActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;
  const provider = triqeeActionProvider();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("supportsNetwork", () => {
    it("should return true for base-mainnet", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" } as any)).toBe(true);
    });

    it("should return true for base-sepolia", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-sepolia" } as any)).toBe(true);
    });

    it("should return false for ethereum-mainnet", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "ethereum-mainnet" } as any)).toBe(false);
    });
  });

  describe("getLeadLagDivergence", () => {
    it("should return divergence data when gateway responds 200", async () => {
      const mockData = {
        status: "DELIVERED",
        alpha_package: "TOKYO_TY3_VS_BASE_LEADLAG_DIVERGENCE",
        data: { eth_spread_bps: 14.5, net_eth_alpha_bps: 8.5 }
      };
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        json: async () => mockData
      });

      const res = await provider.getLeadLagDivergence(null as any, { demo: true });
      const parsed = JSON.parse(res);
      expect(parsed.status).toEqual("DELIVERED");
      expect(parsed.data.eth_spread_bps).toEqual(14.5);
    });

    it("should return RFC-402 payment challenge when gateway responds 402", async () => {
      const challengeData = {
        error: "PAYMENT_REQUIRED",
        price_usd: 0.001,
        recipient: "0x676A66D77B4B14C2f981239f7368Ab5cc37aC666"
      };
      fetchMock.mockResolvedValueOnce({
        status: 402,
        ok: false,
        json: async () => challengeData
      });

      const res = await provider.getLeadLagDivergence(null as any, { demo: false });
      const parsed = JSON.parse(res);
      expect(parsed.status).toEqual("PAYMENT_REQUIRED");
      expect(parsed.protocol).toEqual("RFC-402");
    });
  });

  describe("getB20InstitutionalCarry", () => {
    it("should return institutional B20 assets", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

      const res = await provider.getB20InstitutionalCarry(null as any, { assetClass: "ALL" });
      const parsed = JSON.parse(res);
      expect(parsed.whitelisted_assets.length).toBeGreaterThan(0);
      expect(parsed.router_contract).toEqual("0xa0F19fFA4a1F4672ba2504Afc1cDfa2FaeF2C685");
    });
  });
});
