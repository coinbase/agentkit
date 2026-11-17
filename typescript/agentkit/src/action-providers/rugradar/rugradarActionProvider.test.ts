import { rugradarActionProvider, RugRadarActionProvider } from "./rugradarActionProvider";
import { RUGRADAR_BASE_URL } from "./constants";

jest.mock("../../analytics", () => ({
  sendAnalyticsEvent: jest.fn().mockResolvedValue(undefined),
}));

const MOCK_TOKEN_RESPONSE = {
  ok: true,
  mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  name: "Bonk",
  symbol: "Bonk",
  score: 0,
  risk_level: "Low risk",
  summary: "No major red flags found.",
  flags: [
    { sev: "good", text: "Mint authority revoked." },
    { sev: "warn", text: "Top 10 wallets hold 38%." },
  ],
  report_url: `${RUGRADAR_BASE_URL}/t/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263`,
};

const MOCK_LINK_RESPONSE = {
  ok: true,
  score: 89,
  verdict: "Danger",
  summary: "Looks like a scam.",
  flags: [{ sev: "danger", text: "Lookalike domain." }],
};

/**
 * Builds a minimal fetch Response mock.
 *
 * @param status - HTTP status
 * @param body - JSON body
 * @returns A Response-like object
 */
function mockResponse(status: number, body: unknown): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

describe("RugRadarActionProvider", () => {
  let provider: RugRadarActionProvider;

  beforeEach(() => {
    delete process.env.RUGRADAR_API_KEY;
    provider = rugradarActionProvider();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.RUGRADAR_API_KEY;
  });

  describe("constructor", () => {
    it("should work without an API key", () => {
      expect(provider["apiKey"]).toBeUndefined();
    });

    it("should read the API key from config or the environment", () => {
      expect(rugradarActionProvider({ apiKey: "cfg-key" })["apiKey"]).toBe("cfg-key");
      process.env.RUGRADAR_API_KEY = "env-key";
      expect(rugradarActionProvider()["apiKey"]).toBe("env-key");
    });
  });

  describe("checkSolanaTokenRisk", () => {
    it("should return a formatted risk summary", async () => {
      const fetchMock = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(mockResponse(200, MOCK_TOKEN_RESPONSE));

      const result = await provider.checkSolanaTokenRisk({ query: "$BONK" });

      expect(fetchMock).toHaveBeenCalledWith(
        `${RUGRADAR_BASE_URL}/api/check?q=%24BONK`,
        expect.objectContaining({ headers: { Accept: "application/json" } }),
      );
      expect(result).toContain("Risk score: 0/100 (Low risk)");
      expect(result).toContain(MOCK_TOKEN_RESPONSE.report_url);
      expect(result.indexOf("[warn]")).toBeLessThan(result.indexOf("[good]"));
    });

    it("should send the Pro key as a bearer token", async () => {
      const fetchMock = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(mockResponse(200, MOCK_TOKEN_RESPONSE));

      await rugradarActionProvider({ apiKey: "pro-key" }).checkSolanaTokenRisk({ query: "BONK" });

      expect(fetchMock.mock.calls[0][1]).toEqual({
        headers: { Accept: "application/json", Authorization: "Bearer pro-key" },
      });
    });

    it("should explain the free daily limit on 402", async () => {
      jest.spyOn(global, "fetch").mockResolvedValue(mockResponse(402, { ok: false }));

      const result = await provider.checkSolanaTokenRisk({ query: "BONK" });

      expect(result).toContain("free daily limit reached");
    });

    it("should return API errors", async () => {
      jest
        .spyOn(global, "fetch")
        .mockResolvedValue(mockResponse(422, { ok: false, error: "Token not found" }));

      const result = await provider.checkSolanaTokenRisk({ query: "nope" });

      expect(result).toBe("Error checking token with RugRadar: Token not found");
    });

    it("should handle network errors", async () => {
      jest.spyOn(global, "fetch").mockRejectedValue(new Error("Network error"));

      const result = await provider.checkSolanaTokenRisk({ query: "BONK" });

      expect(result).toBe("Error checking token with RugRadar: Network error");
    });
  });

  describe("scanLinkForDrainer", () => {
    it("should return a formatted scan result", async () => {
      const fetchMock = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(mockResponse(200, MOCK_LINK_RESPONSE));

      const result = await provider.scanLinkForDrainer({
        text: "https://claim-solana-rewards.xyz",
      });

      expect(fetchMock.mock.calls[0][0]).toBe(
        `${RUGRADAR_BASE_URL}/api/scan-link?text=${encodeURIComponent("https://claim-solana-rewards.xyz")}`,
      );
      expect(result).toContain("89/100 (Danger)");
      expect(result).toContain("Lookalike domain.");
    });

    it("should handle network errors", async () => {
      jest.spyOn(global, "fetch").mockRejectedValue(new Error("boom"));

      const result = await provider.scanLinkForDrainer({ text: "https://example.com" });

      expect(result).toBe("Error scanning link with RugRadar: boom");
    });
  });

  describe("supportsNetwork", () => {
    it("should support all networks", () => {
      expect(provider.supportsNetwork({ protocolFamily: "svm", networkId: "solana-mainnet" })).toBe(
        true,
      );
      expect(provider.supportsNetwork({ protocolFamily: "evm", networkId: "base-mainnet" })).toBe(
        true,
      );
    });
  });
});
