import { DegenscanIntelActionProvider } from "./degenscanIntelActionProvider";

describe("DegenscanIntelActionProvider", () => {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fakeFetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: init?.headers as Record<string, string> });
    return new Response(JSON.stringify({ ok: true, url }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  const provider = new DegenscanIntelActionProvider({ fetchFn: fakeFetch });

  beforeEach(() => {
    calls.length = 0;
  });

  it("sends free-trial header when no api key is set", async () => {
    await provider.getMarketPulse({});
    expect(calls[0].url).toBe("https://intel.degenscan.io/v1/pulse");
    expect(calls[0].headers["x-free-trial"]).toBe("1");
  });

  it("builds the events query", async () => {
    await provider.getMarketEvents({
      since: "4h",
      universe: ["BTC", "NVDA"],
      minConfidence: 0.5,
      limit: 10,
    });
    expect(calls[0].url).toBe(
      "https://intel.degenscan.io/v1/events?since=4h&universe=BTC%2CNVDA&min_confidence=0.5&limit=10",
    );
  });

  it("uppercases asset ids and sends api key", async () => {
    const p = new DegenscanIntelActionProvider({ fetchFn: fakeFetch, apiKey: "k_test" });
    await p.getAssetBrief({ assetId: "btc", since: "24h" });
    await p.getPerpDerivs({ symbol: "eth" });
    expect(calls[0].url).toBe("https://intel.degenscan.io/v1/brief/BTC?since=24h");
    expect(calls[1].url).toBe("https://intel.degenscan.io/v1/derivs/ETH");
    expect(calls[0].headers["x-api-key"]).toBe("k_test");
  });

  it("calls the Deribit perps route with symbols joined", async () => {
    const calls: string[] = [];
    const p = new DegenscanIntelActionProvider({
      fetchFn: (async (u: string) => {
        calls.push(u);
        return new Response("{}", { status: 200 });
      }) as unknown as typeof fetch,
    });
    await p.getDeribitPerps({ symbols: ["BTC", "SOL"], sort: "gap", limit: 10 });
    expect(calls[0]).toBe(
      "https://intel.degenscan.io/v1/deribit/perps?symbols=BTC%2CSOL&sort=gap&limit=10",
    );
  });

  it("returns a helpful message on 402", async () => {
    const p = new DegenscanIntelActionProvider({
      fetchFn: (async () => new Response("{}", { status: 402 })) as unknown as typeof fetch,
    });
    expect(await p.getMarketPulse({})).toContain("Payment required");
  });

  it("supports all networks", () => {
    expect(provider.supportsNetwork()).toBe(true);
  });
});
