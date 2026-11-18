import { agentRadarActionProvider } from "./agentRadarActionProvider";
import { AgentRadarVerifyResponse } from "./types";

describe("AgentRadarActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const provider = agentRadarActionProvider();
  const address = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("verifyAgent", () => {
    it("should return the trust result when the API call is successful", async () => {
      const mockResponse: AgentRadarVerifyResponse = {
        address,
        score: 82,
        verdict: "TRUSTED",
        signals: { identity: 90, reputation: 80, scamDetection: 95 },
        riskFlags: [],
      };
      fetchMock.mockResolvedValue({ ok: true, json: jest.fn().mockResolvedValue(mockResponse) });

      const result = await provider.verifyAgent({ address });
      const parsed = JSON.parse(result);

      expect(parsed.score).toBe(82);
      expect(parsed.verdict).toBe("TRUSTED");
      expect(parsed.signals.scamDetection).toBe(95);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/verify?target="),
        expect.objectContaining({ headers: { accept: "application/json" } }),
      );
    });

    it("should lowercase the address in the request", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ address, score: 50, verdict: "CAUTION" }),
      });

      await provider.verifyAgent({ address });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(address.toLowerCase()),
        expect.any(Object),
      );
    });

    it("should handle API errors gracefully", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });
      const result = await provider.verifyAgent({ address });
      expect(result).toContain("Error verifying agent");
    });

    it("should handle network errors", async () => {
      fetchMock.mockRejectedValue(new Error("Network error"));
      const result = await provider.verifyAgent({ address });
      expect(result).toContain("Error verifying agent");
      expect(result).toContain("Network error");
    });
  });

  describe("getTrustBadge", () => {
    it("should return a badge URL with the default style", async () => {
      const result = await provider.getTrustBadge({ address, style: null });
      expect(result).toContain(`/badge/${address.toLowerCase()}`);
      expect(result).toContain("style=flat");
    });

    it("should return a badge URL with a custom style", async () => {
      const result = await provider.getTrustBadge({ address, style: "detailed" });
      expect(result).toContain("style=detailed");
    });
  });

  describe("supportsNetwork", () => {
    it("should return true for any network", () => {
      expect(provider.supportsNetwork()).toBe(true);
    });
  });
});
