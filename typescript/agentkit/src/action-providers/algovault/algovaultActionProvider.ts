import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  GetTradeCallSchema,
  GetTradeSignalSchema,
  GetMarketRegimeSchema,
  ScanFundingArbSchema,
} from "./schemas";
import { ALGOVAULT_MCP_URL } from "./constants";
import { AlgoVaultActionProviderConfig } from "./types";
import { callAlgoVaultTool, formatAlgoVaultError } from "./utils";

/**
 * AlgoVaultActionProvider exposes AlgoVault's crypto trading signals to an
 * AgentKit agent. It is a walletless, read-only data provider that calls the
 * AlgoVault MCP server (`api.algovault.com/mcp`) over Streamable HTTP.
 *
 * The free tier is keyless (no API key required); an optional `ALGOVAULT_API_KEY`
 * unlocks paid-tier limits. All verdicts are backed by AlgoVault's verified,
 * on-chain (Base Merkle-anchored) track record.
 *
 * @augments ActionProvider
 */
export class AlgoVaultActionProvider extends ActionProvider {
  private readonly apiKey?: string;
  private readonly baseUrl: string;

  /**
   * Constructor for the AlgoVaultActionProvider class.
   *
   * @param config - The configuration options for the AlgoVaultActionProvider.
   */
  constructor(config: AlgoVaultActionProviderConfig = {}) {
    super("algovault", []);

    // Keyless by default — the free tier needs no key. An optional key (config
    // or ALGOVAULT_API_KEY) unlocks paid-tier limits.
    this.apiKey = config.apiKey ?? process.env.ALGOVAULT_API_KEY;
    this.baseUrl = config.baseUrl ?? ALGOVAULT_MCP_URL;
  }

  /**
   * Returns AlgoVault's composite BUY/SELL/HOLD trade call for a market.
   *
   * @param args - The trade-call inputs (coin, timeframe, exchange, reasoning).
   * @returns A JSON string with the verdict, confidence, regime, and reasoning.
   */
  @CreateAction({
    name: "get_trade_call",
    description: `
This tool returns AlgoVault's composite BUY / SELL / HOLD trade call for a crypto perpetual-futures market (or a supported TradFi symbol).
It takes a coin symbol (e.g. BTC, ETH, SOL), an optional candle timeframe (default 15m), an optional perp venue (default BINANCE), and whether to include reasoning.
Returns a JSON object with the verdict, confidence, market regime, funding rate, and reasoning, backed by AlgoVault's verified, on-chain (Base Merkle-anchored) track record. The free tier is keyless — no API key required.
`,
    schema: GetTradeCallSchema,
  })
  async getTradeCall(args: z.infer<typeof GetTradeCallSchema>): Promise<string> {
    return this.callTool("get_trade_call", args);
  }

  /**
   * Alias of `get_trade_call` (same behavior, kept for backward compatibility).
   *
   * @param args - The trade-call inputs (coin, timeframe, exchange, reasoning).
   * @returns A JSON string with the verdict, confidence, regime, and reasoning.
   */
  @CreateAction({
    name: "get_trade_signal",
    description: `
Alias of get_trade_call — returns AlgoVault's composite BUY / SELL / HOLD trade call (same behavior, kept for backward compatibility). Prefer get_trade_call for new integrations.
It takes a coin symbol, an optional timeframe (default 15m), an optional perp venue (default BINANCE), and whether to include reasoning.
Returns a JSON object with the verdict, confidence, market regime, funding rate, and reasoning, backed by AlgoVault's verified, on-chain (Base Merkle-anchored) track record.
`,
    schema: GetTradeSignalSchema,
  })
  async getTradeSignal(args: z.infer<typeof GetTradeSignalSchema>): Promise<string> {
    return this.callTool("get_trade_signal", args);
  }

  /**
   * Classifies the current market regime for a market.
   *
   * @param args - The regime inputs (coin, timeframe, exchange).
   * @returns A JSON string with the regime label, confidence, and strategy hint.
   */
  @CreateAction({
    name: "get_market_regime",
    description: `
This tool classifies the current market regime — TRENDING_UP, TRENDING_DOWN, RANGING, or VOLATILE — for a crypto perpetual-futures market.
It takes a coin symbol, an optional timeframe (1h / 4h / 1d, default 4h), and an optional perp venue (default HL).
Returns a JSON object with the regime label, confidence, and a strategy hint, blending trend/ranging signals, volatility, and cross-venue funding sentiment. Backed by AlgoVault's verified, on-chain (Base Merkle-anchored) track record.
`,
    schema: GetMarketRegimeSchema,
  })
  async getMarketRegime(args: z.infer<typeof GetMarketRegimeSchema>): Promise<string> {
    return this.callTool("get_market_regime", args);
  }

  /**
   * Scans for cross-venue funding-rate arbitrage opportunities.
   *
   * @param args - The scan inputs (minimum spread, result limit).
   * @returns A JSON string listing ranked funding-arbitrage opportunities.
   */
  @CreateAction({
    name: "scan_funding_arb",
    description: `
This tool scans for cross-venue funding-rate arbitrage opportunities across Binance, Bybit, OKX, Bitget, and Hyperliquid perpetual futures (long one venue, short another).
It takes an optional minimum funding-rate spread in basis points (default 5) and an optional result limit (default 10; the keyless free tier returns up to 5).
Returns a JSON list of ranked opportunities with the funding spread per venue pair. Backed by AlgoVault's verified, on-chain (Base Merkle-anchored) track record.
`,
    schema: ScanFundingArbSchema,
  })
  async scanFundingArb(args: z.infer<typeof ScanFundingArbSchema>): Promise<string> {
    return this.callTool("scan_funding_arb", args);
  }

  /**
   * Checks if the action provider supports the given network. AlgoVault signals
   * are network-agnostic, so this always returns true.
   *
   * @param _ - The network to check (unused).
   * @returns Always true — AlgoVault signals are network-agnostic.
   */
  supportsNetwork(_: Network): boolean {
    return true;
  }

  /**
   * Invokes an AlgoVault MCP tool and returns its text content, converting any
   * transport-level failure into a structured, LLM-readable error string.
   *
   * @param name - The AlgoVault MCP tool name.
   * @param args - The tool arguments.
   * @returns The tool result text, or a formatted error string.
   */
  private async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    try {
      return await callAlgoVaultTool({
        baseUrl: this.baseUrl,
        apiKey: this.apiKey,
        name,
        arguments: args,
      });
    } catch (error) {
      return formatAlgoVaultError(error, name);
    }
  }
}

/**
 * Factory function to create a new AlgoVaultActionProvider instance.
 *
 * @param config - The configuration options for the AlgoVaultActionProvider.
 * @returns A new instance of AlgoVaultActionProvider.
 */
export const algoVaultActionProvider = (config: AlgoVaultActionProviderConfig = {}) =>
  new AlgoVaultActionProvider(config);
