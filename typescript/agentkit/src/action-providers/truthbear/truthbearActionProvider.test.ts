import { truthbearActionProvider } from "./truthbearActionProvider";

describe("TruthbearActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const provider = truthbearActionProvider();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("verify", () => {
    it("should return formatted fact when API call is successful", async () => {
      const mockResponse = {
        signal: "macro.unemployment",
        value: "3.7%",
        source_url: "https://fred.stlouisfed.org/series/UNRATE",
        record_hash: "a".repeat(64),
        freshness: "2026-08-30T12:00:00Z",
      };
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await provider.verify({ query: "US unemployment rate" });
      expect(result).toContain("Signal: macro.unemployment");
      expect(result).toContain("Value: 3.7%");
      expect(result).toContain("Source: https://fred.stlouisfed.org/series/UNRATE");
      expect(result).toContain("Record Hash:");
      expect(result).toContain("Freshness:");
    });

    it("should handle API errors gracefully", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });
      const result = await provider.verify({ query: "anything" });
      expect(result).toContain("Error verifying fact");
      expect(result).toContain("500");
    });

    it("should handle network errors", async () => {
      fetchMock.mockRejectedValue(new Error("Network error"));
      const result = await provider.verify({ query: "anything" });
      expect(result).toContain("Error verifying fact");
      expect(result).toContain("Network error");
    });

    it("should handle empty response data", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      });
      const result = await provider.verify({ query: "something" });
      expect(result).toBe("{}");
    });

    it("should handle partial response data", async () => {
      const mockResponse = {
        signal: "hydrology.river-level",
        value: "12.5 ft",
      };
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockResponse),
      });

      const result = await provider.verify({ query: "river level" });
      expect(result).toContain("Signal: hydrology.river-level");
      expect(result).toContain("Value: 12.5 ft");
      expect(result).not.toContain("Source:");
    });
  });

  describe("supportsNetwork", () => {
    it("should always return true", () => {
      expect(provider.supportsNetwork()).toBe(true);
    });
  });
});
