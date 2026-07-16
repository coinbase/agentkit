import { nodeflareActionProvider, NodeflareActionProvider } from "./nodeflareActionProvider";

/**
 * Build a fetch mock that returns the given JSON body with a 200 status.
 *
 * @param body - The JSON body to resolve.
 * @returns A jest mock installed on global.fetch.
 */
function mockFetch(body: unknown) {
  return jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => body,
  } as Response);
}

describe("NodeflareActionProvider", () => {
  let provider: NodeflareActionProvider;

  beforeEach(() => {
    provider = nodeflareActionProvider();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("supports every network (chain is an explicit argument)", () => {
    expect(provider.supportsNetwork()).toBe(true);
  });

  describe("getSupportedChains", () => {
    it("lists the supported chains", async () => {
      const response = await provider.getSupportedChains();
      expect(response).toContain("NodeFlare serves");
      expect(response).toContain("eth (chainId 1, ETH)");
      expect(response).toContain("base (chainId 8453, ETH)");
    });
  });

  describe("getBlockNumber", () => {
    it("returns the latest block in decimal and hex", async () => {
      mockFetch({ jsonrpc: "2.0", id: 1, result: "0x2a" });
      const response = await provider.getBlockNumber({ chain: "ethereum" });
      expect(response).toContain("Ethereum latest block: 42 (0x2a)");
    });

    it("resolves a numeric chain ID", async () => {
      mockFetch({ jsonrpc: "2.0", id: 1, result: "0x1" });
      const response = await provider.getBlockNumber({ chain: "8453" });
      expect(response).toContain("Base latest block:");
    });

    it("returns a helpful error for an unknown chain", async () => {
      const response = await provider.getBlockNumber({ chain: "notachain" });
      expect(response).toContain("unknown chain 'notachain'");
    });
  });

  describe("getNativeBalance", () => {
    it("returns a human-readable native balance", async () => {
      mockFetch({ jsonrpc: "2.0", id: 1, result: "0x0de0b6b3a7640000" }); // 1e18
      const response = await provider.getNativeBalance({
        chain: "eth",
        address: "0x0000000000000000000000000000000000000000",
      });
      expect(response).toContain("1 ETH");
      expect(response).toContain("Ethereum");
    });
  });

  describe("getGasPrice", () => {
    it("returns the gas price in gwei", async () => {
      mockFetch({ jsonrpc: "2.0", id: 1, result: "0x3b9aca00" }); // 1e9 wei = 1 gwei
      const response = await provider.getGasPrice({ chain: "base" });
      expect(response).toContain("Base gas price: 1 gwei");
    });

    it("surfaces a gateway error", async () => {
      mockFetch({ error: "rate_limit_exceeded", message: "Public rate limit exceeded." });
      const response = await provider.getGasPrice({ chain: "eth" });
      expect(response).toContain("Error fetching gas price");
      expect(response).toContain("Public rate limit exceeded");
    });
  });
});
