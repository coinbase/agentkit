import { BaseSqlApiActionProvider } from "./baseSqlApiActionProvider";
import { BaseSqlApiSchema } from "./schemas";
import { BASE_SQL_API_URL } from "./constants";

describe("Base SQL API Action Provider", () => {
  let provider: BaseSqlApiActionProvider;
  let originalFetch: typeof fetch | undefined;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    provider = new BaseSqlApiActionProvider();

    process.env.CDP_API_CLIENT_KEY = "test-token";

    originalFetch = globalThis.fetch;
    mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    mockFetch.mockReset();
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    }
    delete process.env.CDP_API_CLIENT_KEY;
  });

  describe("schema validation", () => {
    it("validates a correct payload", () => {
      const validInput = { sqlQuery: "SELECT 1" };
      const parsed = BaseSqlApiSchema.safeParse(validInput);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.sqlQuery).toBe("SELECT 1");
      }
    });

    it("rejects an incorrect payload", () => {
      const invalidInput = { fieldName: "", amount: "invalid" };
      const parsed = BaseSqlApiSchema.safeParse(invalidInput);
      expect(parsed.success).toBe(false);
    });
  });

  describe("executeBaseSqlQuery", () => {
    it("POSTs to the Base SQL API with headers/body and returns the text result", async () => {
      const args = { sqlQuery: "SELECT 1" };
      const mockText = JSON.stringify({ columns: ["one"], rows: [[1]] });

      mockFetch.mockResolvedValue(new Response(mockText, { status: 200 }));

      const result = await provider.executeBaseSqlQuery(args);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        BASE_SQL_API_URL,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
            "Content-Type": "application/json",
            Accept: "application/json",
          }),
          body: JSON.stringify({ sql: args.sqlQuery }),
        }),
      );

      expect(result).toBe(`Query executed with result: ${mockText}.`);
    });

    it("returns a readable error string when response.ok is false", async () => {
      const args = { sqlQuery: "SELECT * FROM nope" };
      mockFetch.mockResolvedValue(new Response("Unauthorized", { status: 401 }));

      const result = await provider.executeBaseSqlQuery(args);

      expect(result).toContain("Error executing Base SQL query:");
      expect(result).toContain("HTTP error! status: 401");
    });

    it("returns a readable error string when fetch throws", async () => {
      const args = { sqlQuery: "SELECT * FROM throws" };
      mockFetch.mockRejectedValue(new Error("boom"));

      const result = await provider.executeBaseSqlQuery(args);
      expect(result).toBe("Error executing Base SQL query: Error: boom");
    });
  });

  describe("supportsNetwork", () => {
    it("returns true for any network", () => {
      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "base-mainnet",
        }),
      ).toBe(true);

      expect(
        provider.supportsNetwork({
          protocolFamily: "evm",
          networkId: "ethereum-mainnet",
        }),
      ).toBe(true);
    });
  });
});
