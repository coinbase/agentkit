import { mizanActionProvider } from "./mizanActionProvider";

describe("MizanActionProvider", () => {
  const fetchMock = jest.fn();
  global.fetch = fetchMock;
  const provider = mizanActionProvider();

  const registry = {
    registry_root: "abc",
    credentials: [
      {
        id: "dsr10-flagship",
        alias: "BTC-TREND-BOOK DSR",
        verdict: "NOT SIGNIFICANT",
        era: "guest v10 · dafad185…",
        anchor: { sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
        links: { bundle: "https://mizan.market/verify/files/x.bundle" },
      },
    ],
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe("verifyCredential", () => {
    it("returns the verdict as issued and hashMatch true when the bundle hash matches", async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(registry) })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
        });
      const out = JSON.parse(
        await provider.verifyCredential({ credentialId: "dsr10-flagship", sha256: null }),
      );
      expect(out.found).toBe(true);
      expect(out.verdict).toBe("NOT_SIGNIFICANT");
      expect(out.hashMatch).toBe(true);
    });

    it("downgrades to UNVERIFIED when the bundle hash does not match", async () => {
      const tampered = {
        ...registry,
        credentials: [{ ...registry.credentials[0], anchor: { sha256: "ff".repeat(32) } }],
      };
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(tampered) })
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
        });
      const out = JSON.parse(
        await provider.verifyCredential({ credentialId: "dsr10-flagship", sha256: null }),
      );
      expect(out.hashMatch).toBe(false);
      expect(out.verdict).toBe("UNVERIFIED");
    });

    it("returns UNVERIFIED for an unknown credential", async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: jest.fn().mockResolvedValue(registry) });
      const out = JSON.parse(
        await provider.verifyCredential({ credentialId: "nope", sha256: null }),
      );
      expect(out.found).toBe(false);
      expect(out.verdict).toBe("UNVERIFIED");
    });

    it("handles API errors gracefully", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
      const out = await provider.verifyCredential({ credentialId: "dsr10-flagship", sha256: null });
      expect(out).toContain("Error verifying credential");
    });
  });

  describe("listDatasets", () => {
    it("returns the trimmed dataset list", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          datasets: [
            {
              key: "btc_4h",
              label: "BTC · 4h",
              bars: 12917,
              interval: "4h",
              venue: "Binance",
              first: "a",
              last: "b",
              sha256: "0db9",
              extra: 1,
            },
          ],
          max_positions: 13000,
        }),
      });
      const out = JSON.parse(await provider.listDatasets({}));
      expect(out.datasets[0].key).toBe("btc_4h");
      expect(out.datasets[0].extra).toBeUndefined();
      expect(out.max_positions).toBe(13000);
    });
  });

  it("supports all networks", () => {
    expect(provider.supportsNetwork()).toBe(true);
  });

  describe("checkAgent", () => {
    it("returns the status from the registry lookup", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: jest
          .fn()
          .mockResolvedValue({ query: "0xabc", status: "UNVERIFIED", found: false, matches: [] }),
      });
      const out = JSON.parse(await provider.checkAgent({ agent: "0xabc", action: "paying you" }));
      expect(out.status).toBe("UNVERIFIED");
      expect(fetchMock.mock.calls[0][0]).toContain("/api/agents/check?q=0xabc&action=paying+you");
    });

    it("defaults the action when none is given", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: jest
          .fn()
          .mockResolvedValue({ query: "bot", status: "PROVEN", found: true, matches: [{}] }),
      });
      const out = JSON.parse(await provider.checkAgent({ agent: "bot", action: null }));
      expect(out.status).toBe("PROVEN");
      expect(fetchMock.mock.calls[0][0]).toContain("action=trusting+you");
    });

    it("returns an error string on HTTP failure", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 503 });
      const out = await provider.checkAgent({ agent: "bot", action: null });
      expect(out).toContain("Error checking agent");
    });
  });
});
