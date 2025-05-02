import { DexpaprikaActionProvider } from "./dexpaprikaActionProvider";

// Mock fetch
global.fetch = jest.fn();

describe("DexpaprikaActionProvider", () => {
  let provider: DexpaprikaActionProvider;
  const mockResponse = { data: "mock data" };
  const mockJsonPromise = Promise.resolve(mockResponse);

  beforeEach(() => {
    provider = new DexpaprikaActionProvider();
    // Reset and setup the fetch mock
    (global.fetch as jest.Mock).mockReset();
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        json: () => mockJsonPromise,
      }),
    );
  });

  it("should be instantiated correctly", () => {
    expect(provider).toBeInstanceOf(DexpaprikaActionProvider);
    expect(provider.name).toBe("dexpaprika");
  });

  it("should support all networks", () => {
    expect(provider.supportsNetwork()).toBe(true);
  });

  describe("getDexPools", () => {
    it("should fetch dex pools data", async () => {
      const args = {
        network: "ethereum",
        dex: "uniswap",
        sort: "desc" as const,
        order_by: "volume_usd" as const,
      };

      await provider.getDexPools(args);

      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.dexpaprika.com/networks/${args.network}/dexes/${args.dex}/pools?sort=${args.sort}&order_by=${args.order_by}&limit=5`,
        { method: "GET" },
      );
    });
  });

  describe("getNetworkDexes", () => {
    it("should fetch network dexes data", async () => {
      const args = { network: "ethereum" };

      await provider.getNetworkDexes(args);

      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.dexpaprika.com/networks/${args.network}/dexes?limit=5`,
        { method: "GET" },
      );
    });
  });

  describe("getNetworkPools", () => {
    it("should fetch network pools data", async () => {
      const args = { network: "ethereum" };

      await provider.getNetworkPools(args);

      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.dexpaprika.com/networks/${args.network}/pools?limit=5`,
        { method: "GET" },
      );
    });
  });

  describe("getPoolDetails", () => {
    it("should fetch pool details data", async () => {
      const args = {
        network: "ethereum",
        pool_address: "0x1234567890abcdef",
      };

      await provider.getPoolDetails(args);

      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.dexpaprika.com/networks/${args.network}/pools/${args.pool_address}`,
        { method: "GET" },
      );
    });
  });

  describe("getTokenDetails", () => {
    it("should fetch token details data", async () => {
      const args = {
        network: "ethereum",
        token_address: "0x1234567890abcdef",
      };

      await provider.getTokenDetails(args);

      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.dexpaprika.com/networks/${args.network}/tokens/${args.token_address}`,
        { method: "GET" },
      );
    });
  });

  describe("getTopPools", () => {
    it("should fetch top pools data", async () => {
      const args = { query: "eth" };

      await provider.getTopPools(args);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.dexpaprika.com/pools?limit=10&page=0&sort=desc&order_by=volume_usd",
        { method: "GET" },
      );
    });
  });

  describe("search", () => {
    it("should search for tokens", async () => {
      const args = { query: "ethereum" };

      await provider.search(args);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.dexpaprika.com/search/?query=ethereum",
        { method: "GET" },
      );
    });
  });
});
