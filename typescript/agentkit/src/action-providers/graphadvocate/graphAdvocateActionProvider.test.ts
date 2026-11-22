import {
  graphAdvocateActionProvider,
  GraphAdvocateActionProvider,
} from "./graphAdvocateActionProvider";
import { Network } from "../../network";
import { GRAPH_ADVOCATE_ENDPOINTS } from "./constants";

const PREVIEW_ROWS = {
  endpoint: "GET /preview",
  paid_endpoint: "POST https://graphadvocate.com/route",
  price: "$0.01 USDC per call on Base via x402",
  question: "uniswap v3 pools",
  free: true,
  live_preview: {
    rows: [{ pool: "USDC/WETH", volume_usd_lifetime: "$610.84B" }],
    row_count: 1,
  },
};

describe("GraphAdvocateActionProvider", () => {
  let provider: GraphAdvocateActionProvider;
  const originalFetch = global.fetch;

  beforeEach(() => {
    provider = graphAdvocateActionProvider({ maxPaymentUsdc: 0.1 });
    global.fetch = originalFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("supportsNetwork", () => {
    it("supports base-mainnet", () => {
      expect(provider.supportsNetwork({ networkId: "base-mainnet" } as Network)).toBe(true);
    });

    it("does not support other networks", () => {
      expect(provider.supportsNetwork({ networkId: "ethereum-mainnet" } as Network)).toBe(false);
      expect(provider.supportsNetwork({ networkId: "base-sepolia" } as Network)).toBe(false);
    });
  });

  describe("get_preview", () => {
    it("GETs /preview?q= and returns live rows without requiring a wallet", async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => PREVIEW_ROWS,
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await provider.getPreview({} as never, { q: "uniswap v3 pools" });
      const parsed = JSON.parse(result);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toBe("https://graphadvocate.com/preview?q=uniswap%20v3%20pools");
      expect(fetchMock.mock.calls[0][1]).toEqual({ method: "GET" });
      expect(parsed.success).toBe(true);
      expect(parsed.endpoint).toBe("/preview");
      expect(parsed.data.live_preview.rows[0].pool).toBe("USDC/WETH");
    });

    it("returns the 400 body when q is missing on the server", async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: { get: () => "application/json" },
        json: async () => ({ error: "missing_q", usage: "GET /preview?q=..." }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await provider.getPreview({} as never, { q: " " });
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.status).toBe(400);
      expect(parsed.data.error).toBe("missing_q");
    });

    it("returns a structured error when fetch throws", async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

      const result = await provider.getPreview({} as never, { q: "uniswap v3 pools" });
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe("Graph Advocate preview request failed");
      expect(parsed.details).toBe("network down");
    });
  });

  describe("payment cap guard", () => {
    it("refuses an action priced above maxPaymentUsdc before signing", async () => {
      // maxPaymentUsdc of 0.001 is below every paid endpoint price, so the action
      // must return a 'Payment exceeds limit' error and never touch the wallet.
      const capped = graphAdvocateActionProvider({ maxPaymentUsdc: 0.001 });
      const result = await capped.getHyperliquidTraderScore({} as never, {
        wallet: "0x38e598961dd0456a7fb2e758bd433d3e59fb8a4a",
      });
      const parsed = JSON.parse(result);
      expect(parsed.error).toBe(true);
      expect(parsed.message).toBe("Payment exceeds limit");
    });

    it("refuses route ($0.01) and ask ($0.05) when they exceed the cap", async () => {
      const capped = graphAdvocateActionProvider({ maxPaymentUsdc: 0.001 });
      const routeResult = JSON.parse(
        await capped.route({} as never, { request: "uniswap v3 pools" }),
      );
      const askResult = JSON.parse(
        await capped.askX402Settlements({} as never, {
          question: "Top 10 recipient addresses last 30 days",
        }),
      );
      expect(routeResult.message).toBe("Payment exceeds limit");
      expect(routeResult.details).toContain(String(GRAPH_ADVOCATE_ENDPOINTS.route.priceUsdc));
      expect(askResult.message).toBe("Payment exceeds limit");
      expect(askResult.details).toContain(String(GRAPH_ADVOCATE_ENDPOINTS.ask.priceUsdc));
    });
  });

  describe("wallet provider guard", () => {
    it("rejects a non-EVM wallet provider for paid actions", async () => {
      const reputation = JSON.parse(
        await provider.getAgentReputation({} as never, {
          wallet: "0x38e598961dd0456a7fb2e758bd433d3e59fb8a4a",
        }),
      );
      const route = JSON.parse(await provider.route({} as never, { request: "uniswap v3 pools" }));
      const ask = JSON.parse(
        await provider.askX402Settlements({} as never, {
          question: "Top 10 recipient addresses last 30 days",
        }),
      );
      expect(reputation.message).toBe("Unsupported wallet provider");
      expect(route.message).toBe("Unsupported wallet provider");
      expect(ask.message).toBe("Unsupported wallet provider");
    });
  });
});
