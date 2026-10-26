import {
  VeriqlActionProvider,
  familyOf,
  priceCapPolicy,
  usdcToAtomic,
} from "./veriqlActionProvider";

const BASE = "https://example.test";

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    json: jest.fn().mockResolvedValue(body),
  }) as unknown as Response;

describe("VeriqlActionProvider", () => {
  const fetchMock = jest.fn();
  const wallet = {} as never;

  beforeEach(() => {
    jest.resetAllMocks();
    global.fetch = fetchMock;
  });

  describe("checkPayee", () => {
    it("sends the API key and returns the verdict", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ result: { verdict: "do_not_pay" } }));
      const provider = new VeriqlActionProvider({ apiKey: "vq_live_test", baseUrl: BASE });

      const result = JSON.parse(await provider.checkPayee(wallet, { address: " 0xabc " }));

      expect(result.result.verdict).toBe("do_not_pay");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${BASE}/api/v1/payee?address=0xabc`);
      expect(init.headers["x-api-key"]).toBe("vq_live_test");
    });

    it("reports a non-2xx answer as unverified, never as clean", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: { code: "provider_unavailable" } }, 503));
      const provider = new VeriqlActionProvider({ apiKey: "k", baseUrl: BASE });

      const result = JSON.parse(await provider.checkPayee(wallet, { address: "0xabc" }));

      expect(result.error).toBe(true);
      expect(result.message).toContain("unverified");
    });

    it("reports a network error as unverified", async () => {
      fetchMock.mockRejectedValue(new Error("Network error"));
      const provider = new VeriqlActionProvider({ apiKey: "k", baseUrl: BASE });

      const result = JSON.parse(await provider.checkPayee(wallet, { address: "0xabc" }));

      expect(result.error).toBe(true);
      expect(result.message).toContain("Network error");
    });

    it("without a key, refuses a wallet that cannot pay over x402 and sends nothing", async () => {
      const prev = process.env.VERIQL_API_KEY;
      delete process.env.VERIQL_API_KEY;
      try {
        const provider = new VeriqlActionProvider({ baseUrl: BASE });
        const result = JSON.parse(await provider.checkPayee(wallet, { address: "0xabc" }));
        expect(result.error).toBe(true);
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        if (prev !== undefined) process.env.VERIQL_API_KEY = prev;
      }
    });
  });

  describe("checkSignature", () => {
    it("posts typed data as an object, not a quoted string", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ result: { decision: "block" } }));
      const provider = new VeriqlActionProvider({ apiKey: "k", baseUrl: BASE });

      await provider.checkSignature(wallet, { payload: '{"primaryType":"PermitSingle"}' });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${BASE}/api/v1/signature`);
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toEqual({ payload: { primaryType: "PermitSingle" } });
    });

    it("sends raw calldata as a string", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ result: { decision: "warn" } }));
      const provider = new VeriqlActionProvider({ apiKey: "k", baseUrl: BASE });

      await provider.checkSignature(wallet, { payload: "0x095ea7b3" });

      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ payload: "0x095ea7b3" });
    });
  });

  describe("checkDenylist", () => {
    it("matches EVM addresses case-insensitively and caches the feed", async () => {
      const listed = "0x098B716B8Aaf21512996dC57EB0615e2383E2f96";
      fetchMock.mockResolvedValue(jsonResponse({ items: [{ value: listed.toLowerCase() }] }));
      const provider = new VeriqlActionProvider({ baseUrl: BASE });

      const hit = JSON.parse(await provider.checkDenylist({ address: listed }));
      const miss = JSON.parse(
        await provider.checkDenylist({ address: "0x0000000000000000000000000000000000000001" }),
      );

      expect(hit.listed).toBe(true);
      expect(hit.verdict).toBe("do_not_pay");
      expect(miss.listed).toBe(false);
      expect(miss.note).toContain("not a statement that the address is safe");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/api/denylist?family=evm`);
    });

    it("never reports clean when the feed is unavailable", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: "unavailable" }, 503));
      const provider = new VeriqlActionProvider({ baseUrl: BASE });

      const result = JSON.parse(
        await provider.checkDenylist({ address: "0x0000000000000000000000000000000000000001" }),
      );

      expect(result.error).toBe(true);
      expect(result.listed).toBeUndefined();
    });

    it("rejects an unrecognised address without a request", async () => {
      const provider = new VeriqlActionProvider({ baseUrl: BASE });
      const result = JSON.parse(await provider.checkDenylist({ address: "hello" }));
      expect(result.error).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("helpers", () => {
    it("puts a Tron address in tron, not solana", () => {
      expect(familyOf("0x098B716B8Aaf21512996dC57EB0615e2383E2f96")).toBe("evm");
      expect(familyOf("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe("tron");
      expect(familyOf("bc1qa5wkgaew2dkv56kfvj49j0av5nml45x9ek9hz6")).toBe("btc");
      expect(familyOf("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")).toBe("solana");
      expect(familyOf("hello")).toBeNull();
    });

    it("drops payment options above the cap or without a readable price", () => {
      expect(usdcToAtomic(0.29)).toBe(BigInt(290000));
      const policy = priceCapPolicy(usdcToAtomic(0.01));
      const kept = policy(2, [
        { amount: "5000", network: "eip155:8453" },
        { amount: "20000", network: "solana" },
        { maxAmountRequired: "10000", network: "base" },
        { network: "no-price" },
        { amount: "not-a-number", network: "bad" },
      ]);
      expect(kept.map(r => r.network)).toEqual(["eip155:8453", "base"]);
    });

    it("registers all three actions", () => {
      const provider = new VeriqlActionProvider({ apiKey: "k" });
      const names = provider.getActions({} as never).map(a => a.name);
      expect(names).toEqual(
        expect.arrayContaining([
          "VeriqlActionProvider_check_payee",
          "VeriqlActionProvider_check_signature",
          "VeriqlActionProvider_check_denylist",
        ]),
      );
    });
  });
});
