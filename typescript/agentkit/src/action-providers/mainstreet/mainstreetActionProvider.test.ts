import { mainstreetActionProvider } from "./mainstreetActionProvider";

describe("MainStreetActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const provider = mainstreetActionProvider();
  const ADDR = "0x325bdf6f7efab24a2210c48c1b64cab2eae1d430";

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("checkReputation", () => {
    it("recommends proceeding for a SAFE counterparty with a real score", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ score: 76, verdict: "SAFE" }),
      });

      const result = JSON.parse(await provider.checkReputation({ address: ADDR }));
      expect(result.score).toBe(76);
      expect(result.verdict).toBe("SAFE");
      expect(result.recommendation).toContain("OK to proceed");
    });

    it("refuses to pay a BLOCK-rated counterparty", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ score: 10, verdict: "BLOCK" }),
      });

      const result = JSON.parse(await provider.checkReputation({ address: ADDR }));
      expect(result.recommendation).toContain("DO NOT PAY");
    });

    it("treats an unknown / unscored counterparty as CAUTION (never auto-OK)", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ score: null, verdict: null }),
      });

      const result = JSON.parse(await provider.checkReputation({ address: ADDR }));
      expect(result.recommendation).toContain("CAUTION");
    });

    it("handles HTTP errors gracefully", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 404 });

      const result = await provider.checkReputation({ address: ADDR });
      expect(result).toContain("MainStreet error");
      expect(result).toContain("404");
    });

    it("handles network errors gracefully", async () => {
      fetchMock.mockRejectedValue(new Error("Network error"));

      const result = await provider.checkReputation({ address: ADDR });
      expect(result).toContain("MainStreet error");
      expect(result).toContain("Network error");
    });
  });

  describe("supportsNetwork", () => {
    it("supports any network (network-agnostic API call)", () => {
      expect(provider.supportsNetwork()).toBe(true);
    });
  });
});
