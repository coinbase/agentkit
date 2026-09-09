import { cdpSqlApiActionProvider } from "./cdpSqlApiActionProvider";
import { CdpSqlApiSchema } from "./schemas";
import { CDP_SQL_API_URL } from "./constants";

describe("CDP SQL API Action Provider", () => {
  let originalFetch: typeof fetch | undefined;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  const mockApiKey = "test-token";

  beforeEach(() => {
    process.env.CDP_API_CLIENT_KEY = mockApiKey;

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

  it("should throw if no API key is provided", () => {
    delete process.env.CDP_API_CLIENT_KEY;
    expect(() => cdpSqlApiActionProvider()).toThrow("CDP_API_CLIENT_KEY is not configured.");
  });

  it("should use provided API key from config", () => {
    const provider = cdpSqlApiActionProvider({ cdpApiClientKey: "foo" });
    expect(provider).toBeDefined();
  });

  const provider = cdpSqlApiActionProvider({ cdpApiClientKey: "test-token" });

  describe("schema validation", () => {
    it("validates a correct payload", () => {
      const validInput = { sqlQuery: "SELECT 1" };
      const parsed = CdpSqlApiSchema.safeParse(validInput);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.sqlQuery).toBe("SELECT 1");
      }
    });

    it("rejects an incorrect payload", () => {
      const invalidInput = { fieldName: "", amount: "invalid" };
      const parsed = CdpSqlApiSchema.safeParse(invalidInput);
      expect(parsed.success).toBe(false);
    });
  });

  describe("executeCdpSqlQuery", () => {
    it("POSTs to the CDP SQL API with headers/body and returns the text result", async () => {
      const args = { sqlQuery: "SELECT 1" };
      const resultPayload = { columns: ["one"], rows: [[1]] };

      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ result: resultPayload }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await provider.executeCdpSqlQuery(args);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        CDP_SQL_API_URL,
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

      expect(result).toBe(JSON.stringify(resultPayload));
    });

    it("returns a readable error string when response.ok is false", async () => {
      const args = { sqlQuery: "SELECT * FROM nope" };
      const errorBody = { errorMessage: "Unauthorized" };

      mockFetch.mockResolvedValue(
        new Response(JSON.stringify(errorBody), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await provider.executeCdpSqlQuery(args);

      expect(result).toContain("Error 401 executing CDP SQL query:");
      expect(result).toContain("Unauthorized");
    });

    it("returns a readable error string when fetch throws", async () => {
      const args = { sqlQuery: "SELECT * FROM throws" };
      mockFetch.mockRejectedValue(new Error("boom"));

      const result = await provider.executeCdpSqlQuery(args);
      expect(result).toBe("Error executing CDP SQL query: Error: boom");
    });
  });

  describe("supportsNetwork", () => {
    it("returns true for base network", () => {
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
      ).toBe(false);
    });
  });
});
