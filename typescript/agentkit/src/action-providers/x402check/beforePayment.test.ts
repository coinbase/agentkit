import { createX402checkBeforePayment } from "./beforePayment";

const MOCK_OK = {
  url: "https://seller.example/api",
  verdict: "ok" as const,
  payTo: "0xabc",
  reasonCodes: ["reachable"],
  history: { checks: 1 },
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

  it("allows payment when verdict is ok", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => MOCK_OK,
    } as Response);

    const hook = createX402checkBeforePayment({ baseUrl: "https://x402check.test" });
    const decision = await hook({ url: "https://seller.example/api", payTo: "0xabc" });

    expect(decision.abort).toBe(false);
    expect(decision.check?.verdict).toBe("ok");
  });

  it("aborts when verdict is avoid", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => MOCK_AVOID,
    } as Response);

    const hook = createX402checkBeforePayment({ baseUrl: "https://x402check.test" });
    const decision = await hook({ url: "https://seller.example/api" });

    expect(decision.abort).toBe(true);
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
    const decision = await hook({ url: "https://seller.example/api" });

    expect(decision.abort).toBe(true);
    expect(decision.reason).toContain("caution");
  });

  it("fails closed when preflight itself returns 402", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 402,
      headers: { get: () => null },
    } as unknown as Response);

    const hook = createX402checkBeforePayment({ baseUrl: "https://x402check.test" });
    const decision = await hook({ url: "https://seller.example/api" });

    expect(decision.abort).toBe(true);
    expect(decision.reason).toContain("x402check_payment_required");
  });

  it("aborts when url is missing", async () => {
    const hook = createX402checkBeforePayment();
    const decision = await hook({ url: "" });
    expect(decision.abort).toBe(true);
    expect(decision.reason).toContain("missing url");
  });
});
