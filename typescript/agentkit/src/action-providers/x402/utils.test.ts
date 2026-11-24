import { createNoRedirectFetch, isServiceRegistered } from "./utils";

describe("isServiceRegistered", () => {
  describe("origin-only registration", () => {
    const registered = new Set(["https://api.example.com"]);

    it("allows URLs on the registered origin", () => {
      expect(isServiceRegistered("https://api.example.com", registered)).toBe(true);
      expect(isServiceRegistered("https://api.example.com/", registered)).toBe(true);
      expect(isServiceRegistered("https://api.example.com/v1/data?x=1", registered)).toBe(true);
    });

    it("rejects hostname-suffix bypasses", () => {
      expect(isServiceRegistered("https://api.example.com.evil.io/x", registered)).toBe(false);
      expect(isServiceRegistered("https://api.example.comevil.io/x", registered)).toBe(false);
    });

    it("rejects userinfo bypasses", () => {
      expect(isServiceRegistered("https://api.example.com@evil.io/x", registered)).toBe(false);
      expect(isServiceRegistered("https://user:pass@api.example.com/x", registered)).toBe(false);
    });

    it("rejects a different scheme or port", () => {
      expect(isServiceRegistered("http://api.example.com/x", registered)).toBe(false);
      expect(isServiceRegistered("https://api.example.com:8443/x", registered)).toBe(false);
    });

    it("rejects non-http(s) schemes and invalid URLs", () => {
      expect(isServiceRegistered("ftp://api.example.com/x", registered)).toBe(false);
      expect(isServiceRegistered("not a url", registered)).toBe(false);
      expect(isServiceRegistered("", registered)).toBe(false);
    });
  });

  describe("path-scoped registration", () => {
    const registered = new Set(["https://api.example.com/api"]);

    it("allows the exact path and nested paths", () => {
      expect(isServiceRegistered("https://api.example.com/api", registered)).toBe(true);
      expect(isServiceRegistered("https://api.example.com/api/", registered)).toBe(true);
      expect(isServiceRegistered("https://api.example.com/api/v1/data?x=1", registered)).toBe(true);
    });

    it("rejects sibling paths sharing the prefix", () => {
      expect(isServiceRegistered("https://api.example.com/apiX", registered)).toBe(false);
      expect(isServiceRegistered("https://api.example.com/api-admin/x", registered)).toBe(false);
    });

    it("rejects the parent path and unrelated paths", () => {
      expect(isServiceRegistered("https://api.example.com/", registered)).toBe(false);
      expect(isServiceRegistered("https://api.example.com/admin", registered)).toBe(false);
    });

    it("rejects dot-segment escapes", () => {
      expect(isServiceRegistered("https://api.example.com/api/../admin", registered)).toBe(false);
      expect(isServiceRegistered("https://api.example.com/api/%2e%2e/admin", registered)).toBe(
        false,
      );
      expect(isServiceRegistered("https://api.example.com/api/%2E%2E/admin", registered)).toBe(
        false,
      );
    });

    it("allows dot-segments that stay inside the registered path", () => {
      expect(isServiceRegistered("https://api.example.com/api/v1/../v2", registered)).toBe(true);
    });
  });

  describe("trailing slash on registered entries", () => {
    it("treats a registered path with a trailing slash as the same scope", () => {
      const registered = new Set(["https://api.example.com/api/"]);
      expect(isServiceRegistered("https://api.example.com/api", registered)).toBe(true);
      expect(isServiceRegistered("https://api.example.com/api/v1", registered)).toBe(true);
      expect(isServiceRegistered("https://api.example.com/apiX", registered)).toBe(false);
    });
    it("does not treat multiple root slashes as origin-only", () => {
      const registered = new Set(["https://api.example.com//"]);
      expect(isServiceRegistered("https://api.example.com/api", registered)).toBe(false);
    });
  });

  describe("registry handling", () => {
    it("returns false when nothing is registered", () => {
      expect(isServiceRegistered("https://api.example.com", new Set())).toBe(false);
    });

    it("skips unparseable registered entries and still matches valid ones", () => {
      const registered = new Set(["garbage", "https://user:pw@evil.io", "https://ok.example.com"]);
      expect(isServiceRegistered("https://ok.example.com/x", registered)).toBe(true);
      expect(isServiceRegistered("https://evil.io/x", registered)).toBe(false);
    });

    it("matches against any registered entry", () => {
      const registered = new Set(["https://a.example.com", "https://b.example.com/api"]);
      expect(isServiceRegistered("https://a.example.com/x", registered)).toBe(true);
      expect(isServiceRegistered("https://b.example.com/api/x", registered)).toBe(true);
      expect(isServiceRegistered("https://b.example.com/other", registered)).toBe(false);
    });

    it("compares origins case-insensitively and ignores default ports", () => {
      const registered = new Set(["https://API.example.com"]);
      expect(isServiceRegistered("https://api.example.com:443/x", registered)).toBe(true);
    });
  });
});

describe("createNoRedirectFetch", () => {
  it("returns redirects without following them", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 302, headers: { location: "https://evil.example/" } }),
      );
    const fetchWithoutRedirects = createNoRedirectFetch(fetchImpl as unknown as typeof fetch);

    const response = await fetchWithoutRedirects("https://api.example.com/api", {
      redirect: "follow",
    });

    expect(response.status).toBe(302);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.example.com/api",
      expect.objectContaining({ redirect: "manual" }),
    );
  });
});
