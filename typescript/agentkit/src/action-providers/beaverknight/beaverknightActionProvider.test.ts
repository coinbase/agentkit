import { beaverknightActionProvider } from "./beaverknightActionProvider";

describe("BeaverKnightActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;

  const provider = beaverknightActionProvider();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  const okResponse = (body: unknown) => ({
    ok: true,
    status: 200,
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  });

  describe("rateWallet", () => {
    it("returns the rating payload and hits /api/rate with the wallet", async () => {
      const payload = {
        version: 1,
        found: true,
        rating: { id: "hlv-pf1-a1b6d8", score: 99, level: "strong" },
        findings: [],
        limits: [{ label: "below size floor", detail: null }],
      };
      fetchMock.mockResolvedValue(okResponse(payload));

      const result = await provider.rateWallet({
        wallet: "0xa1b6d8efbcb2fb750a84dbc05649fa4968034f04",
      });

      expect(JSON.parse(result)).toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://www.beaverknight.com/api/rate?wallet=0xa1b6d8efbcb2fb750a84dbc05649fa4968034f04",
      );
    });

    it("passes a found:false miss through unchanged (a miss is not a pass)", async () => {
      const payload = {
        version: 1,
        found: false,
        rating: null,
        meaning:
          "No Beaver Knight rating exists for this address. That is an ABSENCE OF EVIDENCE, NOT A CLEAN BILL OF HEALTH.",
      };
      fetchMock.mockResolvedValue(okResponse(payload));

      const result = await provider.rateWallet({
        wallet: "0x0000000000000000000000000000000000000001",
      });

      expect(JSON.parse(result).found).toBe(false);
      expect(result).toContain("NOT A CLEAN BILL OF HEALTH");
    });

    it("reports an upstream failure as 'could not check', never as unrated", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
        text: jest.fn().mockResolvedValue('{"error":"upstream_unavailable"}'),
      });

      const result = await provider.rateWallet({ wallet: "0xabc" });

      expect(result).toContain("Error checking wallet");
      expect(result).toContain("503");
      expect(result).toContain('NOT "unrated"');
    });

    it("handles network errors", async () => {
      fetchMock.mockRejectedValue(new Error("Network error"));
      const result = await provider.rateWallet({ wallet: "0xabc" });
      expect(result).toContain("Error checking wallet");
      expect(result).toContain("Network error");
    });
  });

  describe("getVaultRankings", () => {
    it("builds the query from the provided filters and defaults the limit", async () => {
      const payload = { version: 1, vaults: [{ rank: 1, id: "hlv-pf1-a1b6d8" }], withdrawn: [] };
      fetchMock.mockResolvedValue(okResponse(payload));

      const result = await provider.getVaultRankings({
        sort: "calmar",
        level: "strong,solid",
        minTvl: 250000,
        venue: "Hyperliquid",
        limit: null,
      });

      expect(JSON.parse(result)).toEqual(payload);
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl.startsWith("https://www.beaverknight.com/api/vaults?")).toBe(true);
      const params = new URL(calledUrl).searchParams;
      expect(params.get("sort")).toBe("calmar");
      expect(params.get("level")).toBe("strong,solid");
      expect(params.get("min_tvl")).toBe("250000");
      expect(params.get("venue")).toBe("Hyperliquid");
      expect(params.get("limit")).toBe("25");
    });

    it("omits null filters", async () => {
      fetchMock.mockResolvedValue(okResponse({ vaults: [] }));
      await provider.getVaultRankings({
        sort: null,
        level: null,
        minTvl: null,
        venue: null,
        limit: 10,
      });
      const params = new URL(fetchMock.mock.calls[0][0] as string).searchParams;
      expect(params.has("sort")).toBe(false);
      expect(params.has("level")).toBe(false);
      expect(params.has("min_tvl")).toBe(false);
      expect(params.has("venue")).toBe(false);
      expect(params.get("limit")).toBe("10");
    });

    it("handles API errors gracefully", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValue("boom"),
      });
      const result = await provider.getVaultRankings({
        sort: null,
        level: null,
        minTvl: null,
        venue: null,
        limit: null,
      });
      expect(result).toContain("Error fetching vault rankings");
      expect(result).toContain("500");
    });
  });

  describe("getIntegrityReport", () => {
    it("fetches the report by id and returns it unchanged", async () => {
      const payload = {
        found: true,
        subject: { id: "hlv-pf1-a1b6d8", name: "PF1" },
        provenance: { attestation: { uid: "0xec0e" } },
      };
      fetchMock.mockResolvedValue(okResponse(payload));

      const result = await provider.getIntegrityReport({ id: "hlv-pf1-a1b6d8" });

      expect(JSON.parse(result)).toEqual(payload);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://www.beaverknight.com/api/report/hlv-pf1-a1b6d8",
      );
    });

    it("URL-encodes the id", async () => {
      fetchMock.mockResolvedValue(okResponse({ found: false }));
      await provider.getIntegrityReport({ id: "weird id/with slash" });
      expect(fetchMock).toHaveBeenCalledWith(
        "https://www.beaverknight.com/api/report/weird%20id%2Fwith%20slash",
      );
    });

    it("reports an upstream failure as 'could not check'", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
        text: jest.fn().mockResolvedValue("{}"),
      });
      const result = await provider.getIntegrityReport({ id: "x" });
      expect(result).toContain("Error fetching integrity report");
      expect(result).toContain('NOT "unrated"');
    });
  });

  describe("supportsNetwork", () => {
    it("is network-agnostic", () => {
      expect(provider.supportsNetwork()).toBe(true);
    });
  });

  describe("custom base URL", () => {
    it("uses the override and strips a trailing slash", async () => {
      const custom = beaverknightActionProvider("https://example.test/");
      fetchMock.mockResolvedValue(okResponse({ found: false }));
      await custom.rateWallet({ wallet: "0xabc" });
      expect(fetchMock).toHaveBeenCalledWith("https://example.test/api/rate?wallet=0xabc");
    });
  });
});
