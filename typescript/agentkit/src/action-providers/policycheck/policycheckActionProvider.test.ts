import { policycheckActionProvider, PolicyCheckActionProvider } from "./policycheckActionProvider";

const facts = {
  analysis_status: "partial",
  policies: { returns: { facts: { window_days: 30 }, evidence: { window_days: { source_id: "source_1", quote: "Returns within 30 days." } } } },
  clauses: [],
  sources: [{ id: "source_1", acquisition: "server_fetch" }],
  limitations: ["Some policy paths were not retrieved."],
  signed_assessment: { version: "2.1", assessment_id: "fixture", policies: { returns: { facts: { window_days: 30 } } } },
  signature: "test-signature",
  summary: "One return-policy fact extracted.",
};
const response = (data: unknown) => ({ jsonrpc: "2.0", result: { artifacts: [{ parts: [{ kind: "data", data }] }] } });

describe("PolicyCheckActionProvider", () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;
  let provider: PolicyCheckActionProvider;
  beforeEach(() => { jest.resetAllMocks(); global.fetch = fetchMock; provider = policycheckActionProvider(); });
  afterAll(() => { global.fetch = originalFetch; });

  it("uses the default URL or a configured URL and needs no wallet", () => {
    expect(provider["apiUrl"]).toBe("https://policycheck.tools/api/a2a");
    expect(policycheckActionProvider({ apiUrl: "https://custom.test/a2a" })["apiUrl"]).toBe("https://custom.test/a2a");
    expect(provider.supportsNetwork()).toBe(true);
  });
  it("preserves facts, provenance and the exact signed envelope without legacy scores", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => response({ ...facts, riskLevel: "high", buyerProtectionScore: 20 }) });
    const parsed = JSON.parse(await provider.checkUrl({ sellerUrl: "https://example.com" }));
    expect(parsed.success).toBe(true);
    for (const key of ["policies", "sources", "limitations", "signed_assessment", "signature"] as const) expect(parsed[key]).toEqual(facts[key]);
    expect(parsed).not.toHaveProperty("riskLevel");
    expect(parsed).not.toHaveProperty("buyerProtectionScore");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).params.message.parts[0].data).toEqual({ seller_url: "https://example.com" });
    expect(fetchMock.mock.calls[0][1].signal).toBeDefined();
  });
  it("sends text with embedded URLs as structured text and preserves optional seller context", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => response(facts) });
    const policyText = "Returns within 30 days. See https://example.com/help for instructions.";
    await provider.analyze({ policyText, sellerUrl: "https://example.com" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).params.message.parts).toEqual([{ kind: "data", data: { policy_text: policyText, seller_url: "https://example.com" } }]);
  });
  it.each(["no_content", "no_facts", "extraction_failed"])("reports %s as unsuccessful without discarding diagnostics", async status => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => response({ ...facts, analysis_status: status }) });
    const parsed = JSON.parse(await provider.checkUrl({ sellerUrl: "https://example.com" }));
    expect(parsed.success).toBe(false); expect(parsed.analysis_status).toBe(status); expect(parsed.limitations).toEqual(facts.limitations);
  });
  it("does not turn a text-only response into a successful structured analysis", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ result: { artifacts: [{ parts: [{ kind: "text", text: "Summary only" }] }] } }) });
    expect(JSON.parse(await provider.checkUrl({ sellerUrl: "https://example.com" })).success).toBe(false);
  });
  it("reports HTTP, RPC and network errors", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
    expect(JSON.parse(await provider.checkUrl({ sellerUrl: "https://example.com" })).error).toContain("HTTP 503");
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ error: { message: "Unavailable" } }) });
    expect(JSON.parse(await provider.checkUrl({ sellerUrl: "https://example.com" })).error).toBe("Unavailable");
    fetchMock.mockRejectedValueOnce(new Error("Timeout"));
    expect(JSON.parse(await provider.checkUrl({ sellerUrl: "https://example.com" })).error).toContain("Timeout");
  });
});
