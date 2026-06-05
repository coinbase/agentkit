import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { algoVaultActionProvider, AlgoVaultActionProvider } from "./algovaultActionProvider";
import { GetTradeCallSchema, GetMarketRegimeSchema, ScanFundingArbSchema } from "./schemas";
import { extractToolText, formatAlgoVaultToolError, formatAlgoVaultError } from "./utils";
import { ALGOVAULT_MCP_URL } from "./constants";

jest.mock("@modelcontextprotocol/sdk/client/index.js");
jest.mock("@modelcontextprotocol/sdk/client/streamableHttp.js");

const MockedTransport = StreamableHTTPClientTransport as jest.MockedClass<
  typeof StreamableHTTPClientTransport
>;

const mockConnect = Client.prototype.connect as jest.Mock;
const mockCallTool = Client.prototype.callTool as jest.Mock;
const mockClose = Client.prototype.close as jest.Mock;

/**
 * Builds a successful MCP tool result with the given JSON payload as text.
 *
 * @param payload - The object to serialize as the tool's text content.
 * @returns A mock MCP `tools/call` result.
 */
function textResult(payload: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(payload) }] };
}

const TRADE_CALL_VERDICT = {
  call: "HOLD",
  confidence: 15,
  regime: "TRENDING_UP",
  coin: "BTC",
  timeframe: "15m",
};

describe("AlgoVaultActionProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ALGOVAULT_API_KEY;
    mockConnect.mockResolvedValue(undefined);
    mockClose.mockResolvedValue(undefined);
    mockCallTool.mockResolvedValue(textResult(TRADE_CALL_VERDICT));
  });

  describe("constructor", () => {
    it("should initialize keyless (no API key) without throwing", () => {
      const provider = algoVaultActionProvider();
      expect(provider).toBeInstanceOf(AlgoVaultActionProvider);
      expect(provider["apiKey"]).toBeUndefined();
      expect(provider["baseUrl"]).toBe(ALGOVAULT_MCP_URL);
    });

    it("should read the API key from the constructor config", () => {
      const provider = algoVaultActionProvider({ apiKey: "custom-key" });
      expect(provider["apiKey"]).toBe("custom-key");
    });

    it("should read the API key from the ALGOVAULT_API_KEY env var", () => {
      process.env.ALGOVAULT_API_KEY = "env-key";
      expect(algoVaultActionProvider()["apiKey"]).toBe("env-key");
    });

    it("should allow overriding the base URL", () => {
      const provider = algoVaultActionProvider({ baseUrl: "https://example.test/mcp" });
      expect(provider["baseUrl"]).toBe("https://example.test/mcp");
    });
  });

  describe("getTradeCall", () => {
    it("should return the verdict text and call the correct tool", async () => {
      const provider = algoVaultActionProvider();
      const args = {
        coin: "BTC",
        timeframe: "15m" as const,
        includeReasoning: true,
        exchange: "BINANCE" as const,
      };

      const result = await provider.getTradeCall(args);

      expect(mockCallTool).toHaveBeenCalledWith({ name: "get_trade_call", arguments: args });
      expect(result).toContain("HOLD");
      expect(mockClose).toHaveBeenCalled();
    });

    it("should connect keyless (no Authorization header) by default", async () => {
      const provider = algoVaultActionProvider();
      await provider.getTradeCall({
        coin: "BTC",
        timeframe: "15m",
        includeReasoning: true,
        exchange: "BINANCE",
      });

      const [url, options] = MockedTransport.mock.calls[0];
      expect(url.toString()).toBe(ALGOVAULT_MCP_URL);
      expect(options?.requestInit).toBeUndefined();
    });

    it("should send a bearer Authorization header when an API key is set", async () => {
      const provider = algoVaultActionProvider({ apiKey: "secret" });
      await provider.getTradeCall({
        coin: "ETH",
        timeframe: "1h",
        includeReasoning: true,
        exchange: "HL",
      });

      const [, options] = MockedTransport.mock.calls[0];
      expect(options?.requestInit?.headers).toEqual({ Authorization: "Bearer secret" });
    });

    it("should surface a transport-level failure as a structured error", async () => {
      mockCallTool.mockRejectedValueOnce(new Error("network down"));
      const provider = algoVaultActionProvider();

      const result = await provider.getTradeCall({
        coin: "BTC",
        timeframe: "15m",
        includeReasoning: true,
        exchange: "BINANCE",
      });

      expect(result).toContain("AlgoVault get_trade_call request failed: network down");
      expect(mockClose).toHaveBeenCalled();
    });

    it("should surface an AlgoVault structured tool error with suggestions", async () => {
      mockCallTool.mockResolvedValueOnce({
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Symbol not in universe",
              code: "SYMBOL_NOT_IN_UNIVERSE",
              suggested_symbols: ["BTC", "ETH"],
            }),
          },
        ],
      });
      const provider = algoVaultActionProvider();

      const result = await provider.getTradeCall({
        coin: "NOTACOIN",
        timeframe: "15m",
        includeReasoning: true,
        exchange: "BINANCE",
      });

      expect(result).toContain("AlgoVault get_trade_call error [SYMBOL_NOT_IN_UNIVERSE]");
      expect(result).toContain("Symbol not in universe");
      expect(result).toContain("suggested_symbols");
    });
  });

  describe("other actions", () => {
    it("getTradeSignal should call the get_trade_signal tool", async () => {
      const provider = algoVaultActionProvider();
      await provider.getTradeSignal({
        coin: "BTC",
        timeframe: "15m",
        includeReasoning: true,
        exchange: "BINANCE",
      });
      expect(mockCallTool).toHaveBeenCalledWith(
        expect.objectContaining({ name: "get_trade_signal" }),
      );
    });

    it("getMarketRegime should call the get_market_regime tool", async () => {
      mockCallTool.mockResolvedValueOnce(textResult({ regime: "RANGING", confidence: 60 }));
      const provider = algoVaultActionProvider();
      const result = await provider.getMarketRegime({
        coin: "BTC",
        timeframe: "4h",
        exchange: "HL",
      });
      expect(mockCallTool).toHaveBeenCalledWith(
        expect.objectContaining({ name: "get_market_regime" }),
      );
      expect(result).toContain("RANGING");
    });

    it("scanFundingArb should call the scan_funding_arb tool", async () => {
      mockCallTool.mockResolvedValueOnce(textResult([{ pair: "BINANCE/HL", spreadBps: 12 }]));
      const provider = algoVaultActionProvider();
      const result = await provider.scanFundingArb({ minSpreadBps: 5, limit: 10 });
      expect(mockCallTool).toHaveBeenCalledWith(
        expect.objectContaining({ name: "scan_funding_arb" }),
      );
      expect(result).toContain("spreadBps");
    });
  });

  describe("supportsNetwork", () => {
    it("should always return true (network-agnostic)", () => {
      const provider = algoVaultActionProvider();
      expect(provider.supportsNetwork({ protocolFamily: "evm" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "svm" })).toBe(true);
      expect(provider.supportsNetwork({ protocolFamily: "unknown" })).toBe(true);
    });
  });
});

describe("utils", () => {
  describe("extractToolText", () => {
    it("should join text content blocks", () => {
      expect(
        extractToolText(
          {
            content: [
              { type: "text", text: "a" },
              { type: "text", text: "b" },
            ],
          },
          "t",
        ),
      ).toBe("a\nb");
    });

    it("should report an empty response when no text content is present", () => {
      expect(extractToolText({ content: [] }, "get_trade_call")).toContain("empty response");
      expect(extractToolText({}, "get_trade_call")).toContain("empty response");
    });

    it("should format a tool error when isError is set", () => {
      const out = extractToolText(
        { isError: true, content: [{ type: "text", text: '{"error":"boom"}' }] },
        "get_trade_call",
      );
      expect(out).toContain("AlgoVault get_trade_call error");
      expect(out).toContain("boom");
    });
  });

  describe("formatAlgoVaultToolError", () => {
    it("should include code, message, and suggested_* fields", () => {
      const out = formatAlgoVaultToolError(
        JSON.stringify({ code: "X", error: "bad", suggested_action: "retry" }),
        "scan_funding_arb",
      );
      expect(out).toContain("[X]");
      expect(out).toContain("bad");
      expect(out).toContain("suggested_action: retry");
    });

    it("should fall back to raw text for non-JSON input", () => {
      expect(formatAlgoVaultToolError("plain text error", "get_market_regime")).toContain(
        "plain text error",
      );
    });

    it("should report 'unknown error' for empty text", () => {
      expect(formatAlgoVaultToolError("", "get_market_regime")).toContain("unknown error");
    });
  });

  describe("formatAlgoVaultError", () => {
    it("should format Error instances", () => {
      expect(formatAlgoVaultError(new Error("nope"), "get_trade_call")).toContain("nope");
    });

    it("should stringify non-Error values", () => {
      expect(formatAlgoVaultError("weird", "get_trade_call")).toContain("weird");
    });
  });
});

describe("schemas", () => {
  it("GetTradeCallSchema applies defaults", () => {
    expect(GetTradeCallSchema.parse({ coin: "BTC" })).toEqual({
      coin: "BTC",
      timeframe: "15m",
      includeReasoning: true,
      exchange: "BINANCE",
    });
  });

  it("GetTradeCallSchema rejects an over-long coin", () => {
    expect(() => GetTradeCallSchema.parse({ coin: "X".repeat(21) })).toThrow();
  });

  it("GetMarketRegimeSchema applies defaults and rejects an unsupported timeframe", () => {
    expect(GetMarketRegimeSchema.parse({ coin: "BTC" })).toEqual({
      coin: "BTC",
      timeframe: "4h",
      exchange: "HL",
    });
    expect(() => GetMarketRegimeSchema.parse({ coin: "BTC", timeframe: "5m" })).toThrow();
  });

  it("ScanFundingArbSchema applies defaults", () => {
    expect(ScanFundingArbSchema.parse({})).toEqual({ minSpreadBps: 5, limit: 10 });
  });
});
