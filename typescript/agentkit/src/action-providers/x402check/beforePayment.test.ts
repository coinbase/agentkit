import { createX402checkBeforePayment } from "./beforePayment";
import type { X402BeforePaymentContext } from "./types";

const BASE_CTX: X402BeforePaymentContext = {
  url: "https://seller.example/api",
  payTo: "0xabc",
  network: "eip155:8453",
  asset: "0xUSDC",
  amount: "2000",
  method: "GET",
};

const MOCK_OK = {
  url: "https://seller.example/api",
  verdict: "ok" as const,
  payTo: "0xabc",
  network: "eip155:8453",
  priceUsd: 0.002,
  reasonCodes: ["reachable", "payto_stable"],
  history: { checks: 3, uptimePct: 100, payToChanges: [], priceChanges: [] },
};

const MOCK_AVOID = {
  ...MOCK_OK,
  verdict: "avoid" as const,
  reasonCodes: ["unreachable"],
};

describe("createX402checkBeforePayment", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.X402CHECK_SKIP;
  });

  it("allows payment when verdict is ok and returns #1454 decision shape", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => MOCK_OK,
    } as Response);

    const hook = createX402checkBeforePayment({ baseUrl: "https://x402check.test" });
    const decision = await hook(BASE_CTX);

    expect(decision.abort).toBe(false);
    expect(decision.code).toBe("x402check:ok");
    expect(decision.reason).toContain("verdict=ok");
    // Exact #1454 shape: only abort / reason / code — no extra fields.
    expect(Object.keys(decision).sort()).toEqual(["abort", "code", "reason"].sort());
  });

  it("aborts when verdict is avoid with machine-readable code", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => MOCK_AVOID,
    } as Response);

    const hook = createX402checkBeforePayment({ baseUrl: "https://x402check.test" });
    const decision = await hook({ ...BASE_CTX, payTo: null });

    expect(decision.abort).toBe(true);
    expect(decision.code).toBe("x402check:avoid");
    expect(decision.reason).toContain("verdict=avoid");
  });

  it("aborts on caution when abortOnCaution is true", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...MOCK_OK, verdict: "caution" }),
    } as Response);

    const hook = createX402checkBeforePayment({
      baseUrl: "https://x402check.test",
      abortOnCaution: true,
    });
    const decision = await hook(BASE_CTX);

    expect(decision.abort).toBe(true);
    expect(decision.code).toBe("x402check:caution");
  });

  it("does not abort on caution by default (reports code)", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...MOCK_OK, verdict: "caution", reasonCodes: ["price_drift"] }),
    } as Response);

    const hook = createX402checkBeforePayment({ baseUrl: "https://x402check.test" });
    const decision = await hook(BASE_CTX);

    expect(decision.abort).toBe(false);
    expect(decision.code).toBe("x402check:caution");
    expect(decision.reason).toContain("price_drift");
  });

  it("aborts on live payTo mismatch vs context (integrity)", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...MOCK_OK, payTo: "0xdead" }),
    } as Response);

    const hook = createX402checkBeforePayment({ baseUrl: "https://x402check.test" });
    const decision = await hook(BASE_CTX);

    expect(decision.abort).toBe(true);
    expect(decision.code).toBe("x402check:payto_mismatch");
    expect(decision.reason).toContain("payToMismatch");
  });

  it("fails closed when preflight itself returns 402", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 402,
      headers: { get: () => null },
    } as unknown as Response);

    const hook = createX402checkBeforePayment({ baseUrl: "https://x402check.test" });
    const decision = await hook(BASE_CTX);

    expect(decision.abort).toBe(true);
    expect(decision.code).toBe("x402check:preflight_failed");
    expect(decision.reason).toContain("x402check_payment_required");
  });

  it("failOpen allows payment when preflight fails", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 402,
      headers: { get: () => null },
    } as unknown as Response);

    const hook = createX402checkBeforePayment({
      baseUrl: "https://x402check.test",
      failOpen: true,
    });
    const decision = await hook(BASE_CTX);

    expect(decision.abort).toBe(false);
    expect(decision.code).toBe("x402check:unavailable");
  });

  it("aborts when url is missing", async () => {
    const hook = createX402checkBeforePayment();
    const decision = await hook({ ...BASE_CTX, url: "" });
    expect(decision.abort).toBe(true);
    expect(decision.code).toBe("x402check:missing_url");
    expect(decision.reason).toContain("missing url");
  });
});
