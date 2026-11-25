import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { DEXRA_API_URL } from "./constants";
import {
  DescribeAddressSchema,
  NewLaunchesSchema,
  PoolHealthSchema,
  SwapPreflightSchema,
  TokenDeepCheckSchema,
  WalletCheckSchema,
} from "./schemas";

/**
 * Configuration options for the DexraActionProvider.
 */
export interface DexraActionProviderConfig {
  /**
   * Dexra API key (dxr_...). Optional: without one, describe_address is free and the other
   * actions return the x402 price to pay per call. Defaults to the DEXRA_API_KEY env var.
   */
  apiKey?: string;
}

type Query = Record<string, string | number | boolean | undefined>;

/**
 * DexraActionProvider checks Solana token launches, holders, wallets, pools and planned swaps
 * with Dexra (https://dexra.dev). Every check returns a verdict (ok, caution, avoid or unknown),
 * the reasons behind it, a summary and the evidence.
 */
export class DexraActionProvider extends ActionProvider {
  private readonly apiKey?: string;

  /**
   * Constructor for the DexraActionProvider class.
   *
   * @param config - The configuration options for the DexraActionProvider
   */
  constructor(config: DexraActionProviderConfig = {}) {
    super("dexra", []);
    this.apiKey = config.apiKey || process.env.DEXRA_API_KEY || undefined;
  }

  /**
   * Describes any Solana address.
   *
   * @param args - The address to describe
   * @returns A JSON string with the description, or an error message
   */
  @CreateAction({
    name: "describe_address",
    description: `
This tool tells what a Solana address is using Dexra: a wallet, token mint, pool or program, its age, activity and basic stats, and which Dexra check answers the next question.
It is free. Call it first with any Solana address you do not recognise.

Inputs:
- address: any Solana address`,
    schema: DescribeAddressSchema,
  })
  async describeAddress(args: z.infer<typeof DescribeAddressSchema>): Promise<string> {
    return this.call("describe_address", { address: args.address });
  }

  /**
   * Checks who really holds a Solana token and whether its liquidity and mint are safe.
   *
   * @param args - The token mint to check
   * @returns A JSON string with the verdict and evidence, or an error message
   */
  @CreateAction({
    name: "token_deep_check",
    description: `
This tool checks a Solana token before buying or holding it using Dexra.
It returns a verdict (ok, caution, avoid or unknown) with reasons: top holders funded from the same address merged into one, real concentration, holder and liquidity history, blacklist proximity, mint and freeze authority and Token-2022 extensions.

Inputs:
- mint: the token mint address

Important notes:
- Paid check (0.03 USDC per call, or included in a Dexra plan with an API key)
- Tokens with millions of holders (USDC, USDT) are refused because their holders cannot be listed`,
    schema: TokenDeepCheckSchema,
  })
  async tokenDeepCheck(args: z.infer<typeof TokenDeepCheckSchema>): Promise<string> {
    return this.call("token_deep_check", { mint: args.mint });
  }

  /**
   * Lists new Solana token launches with a verdict for each.
   *
   * @param args - The look-back window and filters
   * @returns A JSON string with the launches, or an error message
   */
  @CreateAction({
    name: "new_launches",
    description: `
This tool lists new Solana tokens and pools from the last N minutes using Dexra: pump.fun, LetsBonk, Raydium LaunchLab, Meteora DBC, PumpSwap, Raydium AMM and CPMM.
Each launch has a verdict (ok, caution, avoid or unknown) with reasons, mint and freeze authority, liquidity, creator history and first-buyer funding.

Inputs:
- minutes (optional): look-back window, 1 to 1440, default 15
- limit (optional): up to 20 launches
- minLiquidityUsd (optional): minimum liquidity in USD
- platforms (optional): launch platforms to include
- includeCollapsed (optional): include launches whose liquidity already collapsed

Important notes:
- Paid check (0.005 USDC per call, 0.01 for windows over 60 minutes, or included in a Dexra plan)`,
    schema: NewLaunchesSchema,
  })
  async newLaunches(args: z.infer<typeof NewLaunchesSchema>): Promise<string> {
    return this.call("new_launches", {
      minutes: args.minutes,
      limit: args.limit,
      min_liquidity_usd: args.minLiquidityUsd,
      platforms: args.platforms?.join(","),
      include_collapsed: args.includeCollapsed,
    });
  }

  /**
   * Checks a Solana wallet.
   *
   * @param args - The wallet to check
   * @returns A JSON string with the verdict and evidence, or an error message
   */
  @CreateAction({
    name: "wallet_check",
    description: `
This tool checks a Solana wallet using Dexra and returns one verdict (ok, caution, avoid or unknown) with reasons: known exchange or not, age, activity, bot or human, PnL on fresh launches, exchange funding, and OFAC or hack links up to two hops.
Use it before sending funds to an address or copying a trader.

Inputs:
- address: the Solana wallet address

Important notes:
- Paid check (0.03 USDC per call, or included in a Dexra plan with an API key)`,
    schema: WalletCheckSchema,
  })
  async walletCheck(args: z.infer<typeof WalletCheckSchema>): Promise<string> {
    return this.call("wallet_check", { address: args.address });
  }

  /**
   * Checks the health of a Solana liquidity pool.
   *
   * @param args - The pool to check
   * @returns A JSON string with the verdict and evidence, or an error message
   */
  @CreateAction({
    name: "pool_health",
    description: `
This tool checks a Solana liquidity pool using Dexra before trading in it or providing liquidity: depth within 2%, slippage for $1k and $10k, 24h liquidity flow, LP return versus holding after impermanent loss, and the share of bot and sandwiched swaps.
It returns a verdict (ok, caution, avoid or unknown) with reasons.

Inputs:
- pool: the pool address (Raydium AMM, CPMM or CLMM, Orca Whirlpool, Meteora DLMM or PumpSwap)

Important notes:
- Paid check (0.03 USDC per call, or included in a Dexra plan with an API key)`,
    schema: PoolHealthSchema,
  })
  async poolHealth(args: z.infer<typeof PoolHealthSchema>): Promise<string> {
    return this.call("pool_health", { pool: args.pool });
  }

  /**
   * Checks a planned Solana swap before it is sent.
   *
   * @param args - The swap to check
   * @returns A JSON string with the verdict and evidence, or an error message
   */
  @CreateAction({
    name: "swap_preflight",
    description: `
This tool checks a planned Solana swap using Dexra before it is sent: price impact on the best route, how often swaps on the pool were sandwiched, Token-2022 transfer fees, hooks and permanent delegate, and mint and freeze authority.
It returns a verdict (ok, caution, avoid or unknown) with reasons.

Inputs:
- mint: the token to buy or sell
- side: "buy" or "sell"
- amount: amount in quote units for a buy (e.g. 0.5 SOL), in token units for a sell
- quote (optional): the quote mint, SOL by default

Important notes:
- Paid check (0.005 USDC per call, or included in a Dexra plan with an API key)`,
    schema: SwapPreflightSchema,
  })
  async swapPreflight(args: z.infer<typeof SwapPreflightSchema>): Promise<string> {
    return this.call("swap_preflight", {
      mint: args.mint,
      side: args.side,
      amount: args.amount,
      quote: args.quote,
    });
  }

  /**
   * Checks if the action provider supports the given network.
   * Dexra reads Solana mainnet and is paid in USDC on Solana mainnet.
   *
   * @param network - The network to check
   * @returns True if the network is Solana mainnet
   */
  supportsNetwork(network: Network): boolean {
    return network.protocolFamily === "svm" && network.networkId === "solana-mainnet";
  }

  /**
   * Calls a Dexra tool over REST.
   *
   * @param tool - The tool name, which is also its path
   * @param query - The query parameters; undefined values are left out
   * @returns The tool's result as JSON, or a message saying what went wrong
   */
  private async call(tool: string, query: Query): Promise<string> {
    const url = new URL(`${DEXRA_API_URL}/${tool}`);
    for (const [name, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(name, String(value));
    }
    try {
      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
      });
      if (response.status === 402) {
        return paymentRequired(
          url.toString(),
          response.headers.get("payment-required"),
          !!this.apiKey,
        );
      }
      const text = await response.text();
      if (!response.ok) {
        return `Error calling Dexra ${tool}: HTTP ${response.status} ${text}`;
      }
      const body = JSON.parse(text) as { result?: unknown };
      return JSON.stringify(body.result ?? body, null, 2);
    } catch (error: unknown) {
      return `Error calling Dexra ${tool}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

/**
 * Explains how to get a paid Dexra check that answered 402 Payment Required.
 *
 * @param url - The request URL that needs payment
 * @param header - The base64 x402 PaymentRequired header, if any
 * @param hasKey - Whether the request carried an API key
 * @returns A message for the agent with the price and the next step
 */
function paymentRequired(url: string, header: string | null, hasKey: boolean): string {
  let price = "";
  try {
    const required = JSON.parse(Buffer.from(header ?? "", "base64").toString("utf8")) as {
      accepts?: { amount?: string; maxAmountRequired?: string }[];
    };
    const amount = Number(
      required.accepts?.[0]?.amount ?? required.accepts?.[0]?.maxAmountRequired,
    );
    if (Number.isFinite(amount) && amount > 0) price = ` for ${amount / 1_000_000} USDC`;
  } catch {
    // The price is a hint; the next step works without it.
  }
  const reason = hasKey
    ? "The Dexra API key has no credits left for this check today."
    : "This Dexra check is paid and no DEXRA_API_KEY is set.";
  return `${reason} Pay per call${price} on Solana with the x402 action provider: call make_http_request_with_x402 with method GET and url ${url} (add ${DEXRA_API_URL} to its registeredServices). Or set DEXRA_API_KEY to a key from https://dexra.dev/app/keys (a confirmed free account includes 100 credits a day).`;
}

/**
 * Factory function to create a new DexraActionProvider instance.
 *
 * @param config - The configuration options for the DexraActionProvider
 * @returns A new instance of DexraActionProvider
 */
export const dexraActionProvider = (config: DexraActionProviderConfig = {}) =>
  new DexraActionProvider(config);
