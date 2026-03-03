import { policycheckActionProvider, PolicyCheckActionProvider } from "./policycheckActionProvider";

// Mock A2A responses
const MOCK_LOW_RISK_RESPONSE = {
  jsonrpc: "2.0",
  id: "1",
  result: {
    id: "task_test_1",
    status: { state: "completed" },
    artifacts: [
      {
        artifactId: "artifact_test_1",
        name: "policy_analysis",
        parts: [
          {
            kind: "data",
            data: {
              riskLevel: "low",
              buyerProtectionScore: 85,
              keyFindings: [
                "30-day return policy with free return shipping",
                "1-year manufacturer warranty included",
                "Full refund to original payment method",
              ],
              summary: "Strong buyer protections detected. 30-day return window, free return shipping, 1-year manufacturer warranty.",
            },
            mimeType: "application/json",
          },
          {
            kind: "text",
            text: "Strong buyer protections across all policy categories. 30-day return window, free return shipping, 1-year warranty.",
          },
        ],
      },
    ],
    messages: [],
  },
};

const MOCK_HIGH_RISK_RESPONSE = {
  jsonrpc: "2.0",
  id: "2",
  result: {
    id: "task_test_2",
    status: { state: "completed" },
    artifacts: [
      {
        artifactId: "artifact_test_2",
        name: "policy_analysis",
        parts: [
          {
            kind: "data",
            data: {
              riskLevel: "high",
              buyerProtectionScore: 25,
              keyFindings: [
                "No return policy found",
                "Binding arbitration clause detected",
                "Liability cap limits seller responsibility to purchase price",
              ],
              summary: "High risk indicators detected. 3 of 5 policy categories flagged. Binding arbitration limits dispute resolution. No return policy found.",
            },
            mimeType: "application/json",
          },
          {
            kind: "text",
            text: "High risk indicators detected. 3 of 5 policy categories flagged. Binding arbitration limits dispute resolution.",
          },
        ],
      },
    ],
    messages: [],
  },
};

const MOCK_ERROR_RESPONSE = {
  jsonrpc: "2.0",
  id: "3",
  error: {
    code: -32000,
    message: "Analysis failed: unable to fetch policy page",
  },
};

describe("PolicyCheckActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  let provider: PolicyCheckActionProvider;

  beforeEach(() => {
    jest.resetAllMocks().restoreAllMocks();
    provider = policycheckActionProvider();
  });

  describe("constructor", () => {
    it("should use default API URL when no config provided", () => {
      const p = policycheckActionProvider();
      expect(p["apiUrl"]).toBe("https://policycheck.tools/api/a2a");
    });

    it("should use custom API URL from config", () => {
      const p = policycheckActionProvider({ apiUrl: "https://custom.api/a2a" });
      expect(p["apiUrl"]).toBe("https://custom.api/a2a");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for any network", () => {
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" } as any)).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "solana", networkId: "mainnet" } as any)).toBe(true);
    });
  });

  describe("analyze", () => {
    it("should return low-risk assessment for safe seller policies", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_LOW_RISK_RESPONSE,
      });

      const result = await provider.analyze({
        policyText:
          "30-day return policy. Free return shipping. Full refund within 5 business days. 1-year warranty.",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.riskLevel).toBe("low");
      expect(parsed.buyerProtectionScore).toBe(85);
      expect(parsed.summary).toContain("Strong buyer protections");
      expect(parsed.keyFindings).toHaveLength(3);
      expect(parsed.analyzedUrl).toBe("direct text analysis");
    });

    it("should return high-risk assessment for risky seller policies", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_HIGH_RISK_RESPONSE,
      });

      const result = await provider.analyze({
        policyText: "All sales final. Binding arbitration. Liability capped at $10.",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.riskLevel).toBe("high");
      expect(parsed.buyerProtectionScore).toBe(25);
      expect(parsed.summary).toContain("High risk indicators");
    });

    it("should send seller URL as data part with quick-risk-check skill", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_LOW_RISK_RESPONSE,
      });

      const result = await provider.analyze({
        sellerUrl: "https://example-store.com",
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toBe("https://policycheck.tools/api/a2a");

      const body = JSON.parse(options.body);
      expect(body.method).toBe("message/send");
      expect(body.params.message.parts[0]).toEqual(
        expect.objectContaining({
          kind: "data",
          data: { seller_url: "https://example-store.com", skill: "quick-risk-check" },
        }),
      );

      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.analyzedUrl).toBe("https://example-store.com");
    });

    it("should send policy text as text part", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_LOW_RISK_RESPONSE,
      });

      await provider.analyze({ policyText: "Test policy text" });

      const [, options] = fetchMock.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.params.message.parts[0]).toEqual(
        expect.objectContaining({
          kind: "text",
          text: "Test policy text",
        }),
      );
    });

    it("should return error for API error response", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_ERROR_RESPONSE,
      });

      const result = await provider.analyze({
        sellerUrl: "https://broken-site.com",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("unable to fetch policy page");
    });

    it("should return error for HTTP failure", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await provider.analyze({
        policyText: "Some policy text",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("HTTP 500");
    });

    it("should return error for network failure", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network timeout"));

      const result = await provider.analyze({
        policyText: "Some policy text",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("Network timeout");
    });

    it("should return error when no analysis data in response", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          id: "4",
          result: { id: "task_empty", status: { state: "completed" }, artifacts: [], messages: [] },
        }),
      });

      const result = await provider.analyze({
        policyText: "Some policy text",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain("No analysis data");
    });

    it("should include summary text when available", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_LOW_RISK_RESPONSE,
      });

      const result = await provider.analyze({
        policyText: "Good policy text",
      });
      const parsed = JSON.parse(result);

      expect(parsed.summary).toContain("Strong buyer protections");
    });
  });

  describe("checkUrl", () => {
    it("should delegate to analyze with sellerUrl", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_LOW_RISK_RESPONSE,
      });

      const result = await provider.checkUrl({
        sellerUrl: "https://example-store.com",
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.analyzedUrl).toBe("https://example-store.com");

      // Verify it called the A2A API with quick-risk-check skill
      const [, options] = fetchMock.mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.params.message.parts[0].data.skill).toBe("quick-risk-check");
    });
  });
});
