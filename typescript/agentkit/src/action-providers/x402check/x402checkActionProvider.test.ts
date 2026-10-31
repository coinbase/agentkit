import { x402checkActionProvider, X402checkActionProvider } from "./x402checkActionProvider";
import { DEFAULT_X402CHECK_BASE_URL } from "./constants";

const MOCK_OK = {
  url: "https://www.api-xpay.com/x402/ping",
  verdict: "ok",
  checkedAt: "2026-10-31T18:00:00.000Z",
  live: true,
  cacheAgeMs: 0,
  status: 402,
  latencyMs: 180,
  is402: true,
  priceUsd: 0.005,
  payTo: "0x589a2314a2E05F45e40C4823Da3Ba58D421dB3d8",
  network: "eip155:8453",
  reasonCodes: ["reachable", "http_402", "payto_stable"],
  history: {
    checks: 3,
    uptimePct: 100,
    payToChanges: [],
    priceChanges: [],
  },
};

const MOCK_AVOID = {
  ...MOCK_OK,
  verdict: "avoid",
  reasonCodes: ["unreachable"],
  payTo: null,
  is402: false,
};

describe("X402checkActionProvider", () => {
  let provider: X402checkActionProvider;

  beforeEach(() => {
    provider = x402checkActionProvider({
      baseUrl: "https://x402check.test",
    });
    jest.restoreAllMocks();
    delete process.env.X402CHECK_SKIP;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.X402CHECK_SKIP;
    delete process.env.X402CHECK_URL;
  });

  describe("constructor", () => {
    it("defaults baseUrl to x402check.dev", () => {
      const p = x402checkActionProvider();
      expect(p["config"].baseUrl).toBe(DEFAULT_X402CHECK_BASE_URL);
    });

    it("respects X402CHECK_URL env", () => {
      process.env.X402CHECK_URL = "https://custom.example";
      const p = x402checkActionProvider();
      expect(p["config"].baseUrl).toBe("https://custom.example");
    });

    it("supportsNetwork always returns true", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
        true,
      );
    });
  });

  describe("preflight_check", () => {
    it("returns formatted ToolCheck on success", async () => {
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MOCK_OK,
      } as Response);

      const response = await provider.preflightCheck({
        url: "https://www.api-xpay.com/x402/ping",
        fresh: null,
      });
      const parsed = JSON.parse(response);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://x402check.test/preflight?url=https%3A%2F%2Fwww.api-xpay.com%2Fx402%2Fping",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({ accept: "application/json" }),
        }),
      );
      expect(parsed.success).toBe(true);
      expect(parsed.verdict).toBe("ok");
      expect(parsed.payTo).toBe(MOCK_OK.payTo);
      expect(parsed.guidance).toContain("still enforce");
    });

    it("passes fresh=1 when requested", async () => {
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MOCK_OK,
      } as Response);

      await provider.preflightCheck({
        url: "https://www.api-xpay.com/x402/ping",
        fresh: true,
      });

      expect(fetchMock.mock.calls[0][0]).toContain("fresh=1");
    });

    it("returns structured payment_required on 402", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 402,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "payment-required" ? "eyJ4NDAyVersion" : null,
        },
        json: async () => ({ error: "payment_required" }),
      } as unknown as Response);

      const response = await provider.preflightCheck({
        url: "https://seller.example/api",
      });
      const parsed = JSON.parse(response);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBe("x402check_payment_required");
      expect(parsed.status).toBe(402);
      expect(parsed.hint).toContain("wrapFetchWithPayment");
    });

    it("returns avoid guidance when verdict is avoid", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MOCK_AVOID,
      } as Response);

      const parsed = JSON.parse(await provider.preflightCheck({ url: "https://bad.example/api" }));
      expect(parsed.verdict).toBe("avoid");
      expect(parsed.guidance).toContain("Do not pay");
    });

    it("honors X402CHECK_SKIP without calling fetch", async () => {
      process.env.X402CHECK_SKIP = "1";
      const fetchMock = jest.spyOn(global, "fetch");

      const parsed = JSON.parse(
        await provider.preflightCheck({ url: "https://seller.example/api" }),
      );

      expect(fetchMock).not.toHaveBeenCalled();
      expect(parsed.verdict).toBe("ok");
      expect(parsed.reasonCodes).toContain("preflight_skipped");
    });
  });

  describe("verify_payto", () => {
    it("reports payToMatch when expectedPayTo matches", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MOCK_OK,
      } as Response);

      const parsed = JSON.parse(
        await provider.verifyPayTo({
          url: "https://www.api-xpay.com/x402/ping",
          expectedPayTo: MOCK_OK.payTo,
        }),
      );

      expect(parsed.action).toBe("verify_payto");
      expect(parsed.payToMatch).toBe(true);
      expect(parsed.payTo).toBe(MOCK_OK.payTo);
    });

    it("flags mismatch when expectedPayTo differs", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => MOCK_OK,
      } as Response);

      const parsed = JSON.parse(
        await provider.verifyPayTo({
          url: "https://www.api-xpay.com/x402/ping",
          expectedPayTo: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        }),
      );

      expect(parsed.payToMatch).toBe(false);
      expect(parsed.mismatch).toContain("does not match");
    });
  });
});
