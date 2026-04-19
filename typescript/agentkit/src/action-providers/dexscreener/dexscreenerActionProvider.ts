import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  SearchDexScreenerPairsSchema,
  GetDexScreenerPairsByTokenSchema,
  GetDexScreenerPairSchema,
} from "./schemas";

const DEXSCREENER_BASE_URL = "https://api.dexscreener.com";

interface DexScreenerToken {
  address: string;
  name: string;
  symbol: string;
}

interface DexScreenerPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: DexScreenerToken;
  quoteToken: DexScreenerToken;
  priceNative: string;
  priceUsd?: string;
  volume?: { h24?: number; h6?: number; h1?: number; m5?: number };
  priceChange?: { h24?: number; h6?: number; h1?: number; m5?: number };
  liquidity?: { usd?: number; base?: number; quote?: number };
  fdv?: number;
  marketCap?: number;
  pairCreatedAt?: number;
}

/**
 * Formats a pair into a concise summary for agent consumption.
 *
 * @param pair - The DexScreener pair object to format.
 * @returns A formatted pair summary object.
 */
function formatPair(pair: DexScreenerPair) {
  return {
    chain: pair.chainId,
    dex: pair.dexId,
    pair: `${pair.baseToken.symbol}/${pair.quoteToken.symbol}`,
    pairAddress: pair.pairAddress,
    priceUsd: pair.priceUsd ?? null,
    priceNative: pair.priceNative,
    volume24h: pair.volume?.h24 ?? null,
    priceChange24h: pair.priceChange?.h24 ?? null,
    liquidityUsd: pair.liquidity?.usd ?? null,
    marketCap: pair.marketCap ?? null,
    fdv: pair.fdv ?? null,
    baseToken: pair.baseToken,
    quoteToken: pair.quoteToken,
    url: pair.url,
  };
}

/**
 * DexScreenerActionProvider provides actions for fetching DEX pair data
 * from DexScreener across all supported chains.
 *
 * DexScreener aggregates real-time trading data from hundreds of decentralized
 * exchanges across 80+ blockchains. No API key or authentication is required.
 *
 * Available actions:
 * - search_dexscreener_pairs: Search for pairs by token name, symbol, or address
 * - get_dexscreener_pairs_by_token: Get all trading pairs for a specific token
 * - get_dexscreener_pair: Get detailed data for a specific pair by address
 */
export class DexScreenerActionProvider extends ActionProvider {
  /**
   * Initializes the DexScreenerActionProvider.
   */
  constructor() {
    super("dexscreener", []);
  }

  /**
   * Searches for DEX pairs matching a query string.
   *
   * @param args - The search arguments containing the query string.
   * @returns A JSON string with matching pairs or an error message.
   */
  @CreateAction({
    name: "search_dexscreener_pairs",
    description: `Searches DexScreener for DEX trading pairs matching a query.

Use this to find trading pairs for a token by name, symbol, or contract address across all chains and DEXes.
Returns pairs sorted by liquidity. Useful for discovering where a token is traded and at what price.

Example queries: 'USDC', 'ETH', 'cbBTC', '0x4200000000000000000000000000000000000006'

Response fields per pair:
- pair: base/quote token symbols (e.g. 'WETH/USDC')
- priceUsd: current price in USD
- volume24h: 24-hour trading volume in USD
- priceChange24h: 24-hour price change percentage
- liquidityUsd: total liquidity in USD
- chain: blockchain the pair is on
- dex: DEX protocol name
- url: DexScreener link for the pair`,
    schema: SearchDexScreenerPairsSchema,
  })
  async searchPairs(args: z.infer<typeof SearchDexScreenerPairsSchema>): Promise<string> {
    try {
      const url = `${DEXSCREENER_BASE_URL}/latest/dex/search?q=${encodeURIComponent(args.query)}`;
      const response = await fetch(url);

      if (!response.ok) {
        return JSON.stringify({
          success: false,
          error: `DexScreener API error: ${response.status} ${response.statusText}`,
        });
      }

      const data = (await response.json()) as { pairs?: DexScreenerPair[] };

      if (!data.pairs || data.pairs.length === 0) {
        return JSON.stringify({ success: true, count: 0, pairs: [] });
      }

      const pairs = data.pairs.slice(0, 10).map(formatPair);
      return JSON.stringify({ success: true, count: pairs.length, pairs });
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) });
    }
  }

  /**
   * Fetches all trading pairs for a specific token address on a given chain.
   *
   * @param args - The arguments containing chainId, tokenAddress, and limit.
   * @returns A JSON string with pairs sorted by 24h volume or an error message.
   */
  @CreateAction({
    name: "get_dexscreener_pairs_by_token",
    description: `Fetches all DEX trading pairs for a specific token on a given blockchain.

Use this when you know a token's contract address and want to see all the DEX pairs it trades in,
sorted by 24-hour volume. Useful for finding the most liquid venue to trade a token.

Examples:
- WETH on Base: chainId='base', tokenAddress='0x4200000000000000000000000000000000000006'
- USDC on Base: chainId='base', tokenAddress='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

Response fields per pair:
- pair: base/quote token symbols
- priceUsd: current price in USD
- volume24h: 24-hour trading volume in USD
- liquidityUsd: total liquidity in USD
- dex: DEX protocol name
- url: DexScreener link`,
    schema: GetDexScreenerPairsByTokenSchema,
  })
  async getPairsByToken(args: z.infer<typeof GetDexScreenerPairsByTokenSchema>): Promise<string> {
    try {
      const url = `${DEXSCREENER_BASE_URL}/token-pairs/v1/${encodeURIComponent(args.chainId)}/${encodeURIComponent(args.tokenAddress)}`;
      const response = await fetch(url);

      if (!response.ok) {
        return JSON.stringify({
          success: false,
          error: `DexScreener API error: ${response.status} ${response.statusText}`,
        });
      }

      const data = (await response.json()) as DexScreenerPair[];

      if (!Array.isArray(data) || data.length === 0) {
        return JSON.stringify({ success: true, count: 0, pairs: [] });
      }

      const sorted = [...data].sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0));
      const pairs = sorted.slice(0, args.limit).map(formatPair);

      return JSON.stringify({
        success: true,
        count: pairs.length,
        tokenAddress: args.tokenAddress,
        chainId: args.chainId,
        pairs,
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) });
    }
  }

  /**
   * Fetches detailed data for a specific DEX pair by its contract address.
   *
   * @param args - The arguments containing chainId and pairAddress.
   * @returns A JSON string with the pair details or an error message.
   */
  @CreateAction({
    name: "get_dexscreener_pair",
    description: `Fetches detailed trading data for a specific DEX pair by its contract address.

Use this when you have the exact pair address and want full details including price, volume,
liquidity, price changes, and market cap.

Examples:
- WETH/USDC on Base Aerodrome: chainId='base', pairAddress='0x88A43bbDF9D098eEC7bCEda4e2494615dfD9bB9C'

Response fields:
- pair: base/quote token symbols
- priceUsd: current price in USD
- priceNative: price in quote token
- volume24h: 24-hour trading volume in USD
- priceChange24h: 24-hour price change percentage
- liquidityUsd: total liquidity in USD
- marketCap: fully diluted market cap in USD
- fdv: fully diluted valuation
- url: DexScreener link`,
    schema: GetDexScreenerPairSchema,
  })
  async getPair(args: z.infer<typeof GetDexScreenerPairSchema>): Promise<string> {
    try {
      const url = `${DEXSCREENER_BASE_URL}/latest/dex/pairs/${encodeURIComponent(args.chainId)}/${encodeURIComponent(args.pairAddress)}`;
      const response = await fetch(url);

      if (!response.ok) {
        return JSON.stringify({
          success: false,
          error: `DexScreener API error: ${response.status} ${response.statusText}`,
        });
      }

      const data = (await response.json()) as { pair?: DexScreenerPair; pairs?: DexScreenerPair[] };

      const pair = data.pair ?? data.pairs?.[0];

      if (!pair) {
        return JSON.stringify({
          success: false,
          error: `No pair found for address ${args.pairAddress} on ${args.chainId}`,
        });
      }

      return JSON.stringify({ success: true, pair: formatPair(pair) });
    } catch (error) {
      return JSON.stringify({ success: false, error: String(error) });
    }
  }

  /**
   * Returns true for all networks since DexScreener supports 80+ chains.
   *
   * @param _ - The network (unused).
   * @returns Always true.
   */
  supportsNetwork = (_: Network) => true;
}

export const dexscreenerActionProvider = () => new DexScreenerActionProvider();
