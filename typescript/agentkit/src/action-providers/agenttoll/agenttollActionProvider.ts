import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import {
  ScoutNewTokensSchema,
  TokenSafetySchema,
  PortfolioSchema,
  TokenPriceSchema,
  BasenameSchema,
  MarketBriefSchema,
} from "./schemas";

const DEFAULT_BASE_URL = "https://agenttoll.app";
const SUPPORTED_NETWORKS = ["base-mainnet"];

/**
 * Configuration for AgenttollActionProvider.
 */
export interface AgenttollConfig {
  /** API base URL override (default: https://agenttoll.app) */
  baseUrl?: string;
}

/**
 * AgenttollActionProvider exposes AgentToll's Base-native data APIs as actions.
 *
 * AgentToll (https://agenttoll.app) sells onchain Base data pay-per-call over
 * x402: each action costs $0.001-$0.008 in USDC, paid automatically from the
 * agent's wallet. There are no API keys or accounts, and a request that fails
 * is never charged — settlement only happens when data is returned.
 */
export class AgenttollActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly baseUrl: string;

  /**
   * Creates a new AgenttollActionProvider.
   *
   * @param config - Optional configuration (API base URL override)
   */
  constructor(config: AgenttollConfig = {}) {
    super("agenttoll", []);
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  }

  /**
   * Scouts new Base tokens: fresh pools with a safety verdict attached.
   *
   * @param walletProvider - The wallet that pays for the call
   * @param args - Optional liquidity floor and pool count
   * @returns JSON string with pools, per-pool safety verdicts, and a summary
   */
  @CreateAction({
    name: "scout_new_base_tokens",
    description: `Find tokens that launched on Base in the last ~24 hours AND learn whether each is safe to touch, in one call.
Returns new liquidity pools above a USD floor, each with a safety verdict already attached (simulated buy & sell, buy/sell taxes, owner powers, holder concentration).
Verdicts: high-risk (a check failed), caution (warnings), insufficient-data (too new to judge - never reported as safe), clear.
A pool whose check could not run is returned with safety: null, never dropped.
Costs $0.008 in USDC via x402, paid automatically from the wallet. Not investment advice.`,
    schema: ScoutNewTokensSchema,
  })
  async scoutNewTokens(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ScoutNewTokensSchema>,
  ): Promise<string> {
    return this.paidGet(walletProvider, "/api/base/scout", {
      minLiquidity: args.minLiquidity,
      pools: args.pools,
    });
  }

  /**
   * Runs automated safety checks on a Base token.
   *
   * @param walletProvider - The wallet that pays for the call
   * @param args - The token contract address
   * @returns JSON string with a verdict and the individual check results
   */
  @CreateAction({
    name: "check_base_token_safety",
    description: `Run automated safety checks on a Base token before touching it: a simulated buy AND sell to catch honeypots, buy/sell taxes, contract verification, what the owner can still do (mint, pause, blacklist), holder concentration, and whether anyone can still pull the liquidity.
The verdict is clear, caution, high-risk or insufficient-data - a token too new to check is never reported as clear.
Costs $0.003 in USDC via x402, paid automatically from the wallet. Not investment advice.`,
    schema: TokenSafetySchema,
  })
  async checkTokenSafety(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TokenSafetySchema>,
  ): Promise<string> {
    return this.paidGet(walletProvider, `/api/base/safety/${args.address}`);
  }

  /**
   * Values everything a Base address holds, in USD.
   *
   * @param walletProvider - The wallet that pays for the call
   * @param args - The address plus optional spam floor and row limit
   * @returns JSON string with ETH + ERC-20 holdings, totals, and honesty counters
   */
  @CreateAction({
    name: "get_base_wallet_portfolio",
    description: `Get everything a Base address holds, valued in USD: ETH plus its ERC-20 tokens, largest first, above a spam floor you control.
The reply also says what it did NOT count (holdings below the floor, tokens with no price) instead of quietly answering short, and marks itself partial if only a degraded data path was available.
Costs $0.003 in USDC via x402, paid automatically from the wallet.`,
    schema: PortfolioSchema,
  })
  async getWalletPortfolio(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PortfolioSchema>,
  ): Promise<string> {
    return this.paidGet(walletProvider, `/api/base/portfolio/${args.address}`, {
      minValue: args.minValue,
      limit: args.limit,
    });
  }

  /**
   * Prices any Base token by contract address.
   *
   * @param walletProvider - The wallet that pays for the call
   * @param args - The token contract address
   * @returns JSON string with the USD price and its source
   */
  @CreateAction({
    name: "get_base_token_price",
    description: `Get the current USD price of any token on Base by its contract address, read from onchain DEX liquidity - works for tokens too new or too small for the big price APIs.
Costs $0.001 in USDC via x402, paid automatically from the wallet.`,
    schema: TokenPriceSchema,
  })
  async getTokenPrice(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TokenPriceSchema>,
  ): Promise<string> {
    return this.paidGet(walletProvider, `/api/base/token/${args.address}`);
  }

  /**
   * Resolves a Basename in either direction.
   *
   * @param walletProvider - The wallet that pays for the call
   * @param args - A basename or a 0x address
   * @returns JSON string with the resolution result
   */
  @CreateAction({
    name: "resolve_basename",
    description: `Resolve a Basename (Base's onchain names) in either direction: pass a name like 'jesse.base.eth' (the .base.eth suffix is optional) to get its address and text records, or pass a 0x address to get its primary basename.
Costs $0.001 in USDC via x402, paid automatically from the wallet.`,
    schema: BasenameSchema,
  })
  async resolveBasename(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof BasenameSchema>,
  ): Promise<string> {
    return this.paidGet(walletProvider, `/api/base/name/${encodeURIComponent(args.query)}`);
  }

  /**
   * Fetches a one-call market brief.
   *
   * @param walletProvider - The wallet that pays for the call
   * @param args - Optional list of symbols to price instead of the majors
   * @returns JSON string with prices, Base gas, and market sentiment
   */
  @CreateAction({
    name: "get_market_brief",
    description: `Get a one-call market snapshot: spot prices (BTC/ETH/SOL by default, or up to 6 symbols you choose), current Base gas, and the crypto Fear & Greed sentiment index.
Costs $0.005 in USDC via x402 regardless of how many symbols, paid automatically from the wallet.`,
    schema: MarketBriefSchema,
  })
  async getMarketBrief(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof MarketBriefSchema>,
  ): Promise<string> {
    return this.paidGet(walletProvider, "/api/brief", {
      symbols: args.symbols?.join(","),
    });
  }

  /**
   * Checks whether the provider supports the given network.
   * AgentToll settles USDC on Base mainnet only.
   *
   * @param network - The network to check
   * @returns True if the network is supported
   */
  supportsNetwork = (network: Network) => SUPPORTED_NETWORKS.includes(network.networkId ?? "");

  /**
   * Performs a GET request that pays the x402 quote from the agent's wallet.
   *
   * @param walletProvider - The wallet that signs the USDC authorization
   * @param path - The API path to call
   * @param query - Optional query parameters (undefined values are dropped)
   * @returns The response body as a string, or a JSON error description
   */
  private async paidGet(
    walletProvider: EvmWalletProvider,
    path: string,
    query: Record<string, string | number | undefined> = {},
  ): Promise<string> {
    try {
      const client = new x402Client();
      const account = walletProvider.toSigner();
      const signer = {
        ...account,
        readContract: (args: {
          address: `0x${string}`;
          abi: readonly unknown[];
          functionName: string;
          args?: readonly unknown[];
        }) =>
          walletProvider.readContract({
            address: args.address,
            abi: args.abi as never,
            functionName: args.functionName as never,
            args: args.args as never,
          }),
      };
      registerExactEvmScheme(client, { signer });
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);

      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) params.set(key, String(value));
      }
      const qs = params.toString();

      const response = await fetchWithPayment(`${this.baseUrl}${path}${qs ? `?${qs}` : ""}`, {
        method: "GET",
      });
      const body = await response.text();
      if (!response.ok) {
        return JSON.stringify({
          error: true,
          status: response.status,
          message: body.slice(0, 500),
          note: "A failed request is never charged - settlement only happens when data is returned.",
        });
      }
      return body;
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: `Error calling AgentToll: ${error}`,
      });
    }
  }
}

/**
 * Creates a new AgenttollActionProvider.
 *
 * @param config - Optional configuration (API base URL override)
 * @returns A new AgenttollActionProvider instance
 */
export const agenttollActionProvider = (config?: AgenttollConfig) =>
  new AgenttollActionProvider(config);
