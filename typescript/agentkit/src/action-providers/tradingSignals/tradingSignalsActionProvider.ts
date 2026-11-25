import { z } from "zod";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider, SvmWalletProvider, WalletProvider } from "../../wallet-providers";
import {
  CAIP2_BY_NETWORK_ID,
  DEFAULT_MAX_PAYMENT_USDC,
  REQUEST_TIMEOUT_MS,
  ROUTES,
  SUPPORTED_PAYMENT_NETWORKS,
  TRADING_SIGNALS_BASE_URL,
  TradingSignalsRoute,
  USDC_BY_CAIP2,
} from "./constants";
import {
  TokenPreTradePackSchema,
  TokenRiskVerdictSchema,
  TokenWhaleFlowSchema,
  detectChain,
} from "./schemas";

/**
 * The API's rating value "safe" is shown to users as a green light; the raw value stays unchanged in `data`.
 *
 * @param rating - The rating value from the API
 * @returns The green-light label, or null for any other rating
 */
function greenLightLabel(rating: unknown): string | null {
  const r = String(rating ?? "").toLowerCase();
  return r === "safe" || r === "green_light"
    ? "GREEN LIGHT: passed our check, not a promise"
    : null;
}

/**
 * Configuration options for the TradingSignalsActionProvider.
 */
export interface TradingSignalsActionProviderConfig {
  /**
   * Maximum USDC the provider will pay for a single call. Defaults to 0.05
   * (or the TRADING_SIGNALS_MAX_PAYMENT_USDC env var).
   */
  maxPaymentUsdc?: number;

  /**
   * Optional Trading Signals API key (free key: 100 calls/month). When set, calls are sent with
   * the key and no wallet payment is made; if the monthly quota is used up the provider falls back
   * to paying over x402 from the agent's wallet. Defaults to the TRADING_SIGNALS_API_KEY env var.
   */
  apiKey?: string;

  /**
   * Override the API base URL. Defaults to https://signals.incomefather.com.
   */
  baseUrl?: string;
}

type RouteParams = Record<string, string | number | undefined>;

interface PaymentRequirementLike {
  network: string;
  asset: string;
  amount?: string;
  maxAmountRequired?: string;
}

/**
 * TradingSignalsActionProvider gives agents pre-trade token due diligence from the
 * Trading Signals Toolkit (https://signals.incomefather.com): a risk verdict for Base and Solana
 * tokens, a one-call GO / CAUTION / STOP pre-trade pack, and large-wallet (whale) DEX flow.
 *
 * Each call is paid per request over x402 in USDC (0.01 to 0.02 USDC) from the agent's own
 * wallet on Base mainnet or Solana mainnet. Payments are restricted to USDC and capped per call.
 */
export class TradingSignalsActionProvider extends ActionProvider<WalletProvider> {
  private readonly maxPaymentUsdc: number;
  private readonly apiKey?: string;
  private readonly baseUrl: string;

  /**
   * Constructor for the TradingSignalsActionProvider class.
   *
   * @param config - The configuration options for the provider
   */
  constructor(config: TradingSignalsActionProviderConfig = {}) {
    super("trading_signals", []);

    const envCap = process.env.TRADING_SIGNALS_MAX_PAYMENT_USDC
      ? Number(process.env.TRADING_SIGNALS_MAX_PAYMENT_USDC)
      : undefined;
    const cap = config.maxPaymentUsdc ?? envCap ?? DEFAULT_MAX_PAYMENT_USDC;
    if (!Number.isFinite(cap) || cap <= 0) {
      throw new Error("maxPaymentUsdc must be a positive number of USDC");
    }

    this.maxPaymentUsdc = cap;
    this.apiKey = config.apiKey || process.env.TRADING_SIGNALS_API_KEY || undefined;
    this.baseUrl = (config.baseUrl || TRADING_SIGNALS_BASE_URL).replace(/\/+$/, "");
  }

  /**
   * Gets a green light / caution / avoid risk verdict for a Base or Solana token.
   *
   * @param walletProvider - The wallet provider used to pay for the call
   * @param args - The token address and optional chain
   * @returns A JSON string with the verdict, payment details, and the raw API response
   */
  @CreateAction({
    name: "token_risk_verdict",
    description: `
This tool runs a risk check on a Base ERC-20 or Solana SPL / Token-2022 token before an agent swaps into it or accepts it, using the Trading Signals Toolkit.

It takes the following inputs:
- token: the token address (Base 0x... contract or Solana base58 mint)
- chain: optional, 'base' or 'solana' (detected from the address format when omitted)

It returns a rating of green light (passed our check, not a promise), caution, or avoid with an A-F grade and the reasons behind it (mint and freeze authority, honeypot or sell-tax test, LP lock, top-holder concentration, sniper and bundled wallets, contract flags).

Important notes:
- Costs 0.01 USDC per call, paid over x402 from the agent's wallet on Base mainnet or Solana mainnet. The wallet needs a small USDC balance on that network.
- Use this before buying or swapping into an unfamiliar token, or before accepting a token as payment.
- The result is a heuristic risk signal, not financial advice.
`,
    schema: TokenRiskVerdictSchema,
  })
  async tokenRiskVerdict(
    walletProvider: WalletProvider,
    args: z.infer<typeof TokenRiskVerdictSchema>,
  ): Promise<string> {
    const chain = args.chain ?? detectChain(args.token);
    if (!chain) {
      return this.errorResult("invalid_input", `"${args.token}" is not a Base or Solana address.`);
    }
    if (chain === "base" && !args.token.startsWith("0x")) {
      return this.errorResult("invalid_input", "A Base token address must start with 0x.");
    }
    if (chain === "solana" && args.token.startsWith("0x")) {
      return this.errorResult("invalid_input", "A Solana mint is a base58 address, not 0x.");
    }
    return chain === "base"
      ? this.callRoute(walletProvider, ROUTES.baseTokenVerdict, { address: args.token }, d =>
          this.summarizeVerdict(d),
        )
      : this.callRoute(walletProvider, ROUTES.solanaTokenVerdict, { mint: args.token }, d =>
          this.summarizeVerdict(d),
        );
  }

  /**
   * Gets one GO / CAUTION / STOP pre-trade decision for a Base or Solana token.
   *
   * @param walletProvider - The wallet provider used to pay for the call
   * @param args - The token, optional chain, and optional counterparty wallet and amount
   * @returns A JSON string with the decision, payment details, and the raw API response
   */
  @CreateAction({
    name: "token_pre_trade_pack",
    description: `
This tool returns one GO / CAUTION / STOP decision before an agent buys, swaps into, or pays with a Base or Solana token, using the Trading Signals Toolkit.

It combines, in a single call:
- the token risk verdict (honeypot, authorities, LP lock, holder concentration, snipers)
- an OFAC sanctions screen of the token's mint / owner authorities and of an optional counterparty wallet
- that wallet's USDC pay-readiness for an optional amount

It takes the following inputs:
- token: the token address (Base 0x... contract or Solana base58 mint)
- chain: optional, 'base' or 'solana' (detected when omitted)
- wallet: optional counterparty or paying wallet address to screen
- amount: optional USDC amount that wallet intends to pay (only used with wallet)

Important notes:
- Costs 0.015 USDC per call, paid over x402 from the agent's wallet on Base mainnet or Solana mainnet.
- Prefer this over token_risk_verdict when the agent also needs a sanctions or counterparty check.
- The result is a heuristic risk signal, not financial or legal advice.
`,
    schema: TokenPreTradePackSchema,
  })
  async tokenPreTradePack(
    walletProvider: WalletProvider,
    args: z.infer<typeof TokenPreTradePackSchema>,
  ): Promise<string> {
    return this.callRoute(
      walletProvider,
      ROUTES.tokenPreTradePack,
      {
        token: args.token,
        chain: args.chain,
        wallet: args.wallet,
        amount: args.wallet ? args.amount : undefined,
      },
      d => this.summarizePack(d),
    );
  }

  /**
   * Gets large-wallet (whale) DEX flow for a Base or Solana token.
   *
   * @param walletProvider - The wallet provider used to pay for the call
   * @param args - The token, optional chain, look-back hours, and minimum trade size
   * @returns A JSON string with the whale flow summary, payment details, and the raw API response
   */
  @CreateAction({
    name: "token_whale_flow",
    description: `
This tool shows whether large wallets are accumulating or dumping a Base or Solana token, using the Trading Signals Toolkit.

It takes the following inputs:
- token: the token address (Base 0x... contract or Solana base58 mint)
- chain: optional, 'base' or 'solana' (detected when omitted)
- hours: optional look-back window, 1-24 hours (default 24)
- minUsd: optional minimum trade size in USD to count as a whale trade (default scales with liquidity)

It returns whale buy and sell counts and USD totals, net flow and net flow as a % of liquidity, an accumulation / distribution signal, hourly flow, the largest trades, and the top accumulating and distributing wallets.

Important notes:
- Costs 0.02 USDC per call, paid over x402 from the agent's wallet on Base mainnet or Solana mainnet.
- Use this before chasing or fading a token move.
- The result is market data, not financial advice.
`,
    schema: TokenWhaleFlowSchema,
  })
  async tokenWhaleFlow(
    walletProvider: WalletProvider,
    args: z.infer<typeof TokenWhaleFlowSchema>,
  ): Promise<string> {
    return this.callRoute(
      walletProvider,
      ROUTES.whaleFlow,
      { token: args.token, chain: args.chain, hours: args.hours, minUsd: args.minUsd },
      d => this.summarizeWhale(d),
    );
  }

  /**
   * Checks if the action provider supports the given network. Payments are made in USDC on
   * Base mainnet or Solana mainnet, so the agent's wallet must be on one of those networks.
   *
   * @param network - The network to check
   * @returns True if the wallet can pay on this network
   */
  supportsNetwork = (network: Network): boolean =>
    (SUPPORTED_PAYMENT_NETWORKS as readonly string[]).includes(network.networkId ?? "");

  /**
   * Calls one paid route, paying over x402 from the agent's wallet (or with an API key).
   *
   * @param walletProvider - The wallet provider used to pay
   * @param route - The route to call
   * @param params - Query parameters
   * @param summarize - Builds a short summary from the response body
   * @returns A JSON string result for the LLM
   */
  private async callRoute(
    walletProvider: WalletProvider,
    route: TradingSignalsRoute,
    params: RouteParams,
    summarize: (data: Record<string, unknown>) => string,
  ): Promise<string> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") query.set(key, String(value));
    }
    const url = `${this.baseUrl}${route.path}?${query.toString()}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "coinbase-agentkit/trading-signals",
    };

    try {
      // 1) Optional API key: no wallet payment.
      if (this.apiKey) {
        const res = await this.timedFetch(fetch, url, { ...headers, "x-api-key": this.apiKey });
        if (res.ok) {
          const data = await this.parseBody(res);
          return this.successResult(route, url, data, summarize, { paidWith: "api_key" });
        }
        if (res.status !== 429) {
          return this.errorResult("api_error", `Request failed with status ${res.status}.`, {
            httpStatus: res.status,
            data: await this.parseBody(res),
          });
        }
        // Monthly quota used up: fall through to x402 payment.
      }

      // 2) x402 payment from the agent's wallet.
      if (route.priceUsd > this.maxPaymentUsdc) {
        return this.errorResult(
          "over_payment_cap",
          `This call costs ${route.priceUsd} USDC, above the configured cap of ${this.maxPaymentUsdc} USDC. Nothing was paid.`,
        );
      }
      const networkId = walletProvider.getNetwork().networkId ?? "";
      const caip2 = CAIP2_BY_NETWORK_ID[networkId];
      if (!caip2) {
        return this.errorResult(
          "unsupported_network",
          `Payments are made in USDC on Base mainnet or Solana mainnet; the wallet is on ${networkId || "an unknown network"}. Nothing was paid.`,
        );
      }

      const client = await this.createX402Client(walletProvider, caip2);
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);
      const res = await this.timedFetch(fetchWithPayment, url, headers);
      const data = await this.parseBody(res);

      if (!res.ok) {
        if (res.status === 402) {
          return this.errorResult(
            "payment_failed",
            `Payment was not accepted. The wallet needs at least ${route.priceUsd} USDC on ${networkId}. Nothing was settled.`,
            { httpStatus: res.status },
          );
        }
        return this.errorResult(
          "api_error",
          `Request failed with status ${res.status}. Payment was not settled.`,
          {
            httpStatus: res.status,
            data,
          },
        );
      }

      return this.successResult(route, url, data, summarize, {
        paidWith: "x402",
        payment: this.decodePaymentResponse(
          res.headers.get("payment-response") ?? res.headers.get("x-payment-response"),
        ),
      });
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s; retry shortly.`
          : error instanceof Error
            ? error.message
            : String(error);
      return this.errorResult("request_failed", message);
    }
  }

  /**
   * Creates an x402 client for the agent's wallet that only pays USDC on the wallet's network,
   * at or below the per-call cap.
   *
   * @param walletProvider - The wallet provider used to sign the payment
   * @param caip2 - CAIP-2 identifier of the wallet's network
   * @returns A configured x402 client
   */
  private async createX402Client(
    walletProvider: WalletProvider,
    caip2: string,
  ): Promise<x402Client> {
    const client = new x402Client();

    if (walletProvider instanceof EvmWalletProvider) {
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
    } else if (walletProvider instanceof SvmWalletProvider) {
      const signer = await walletProvider.toSigner();
      registerExactSvmScheme(client, { signer });
    } else {
      throw new Error("Unsupported wallet provider: an EVM or Solana wallet is required to pay.");
    }

    const capAtomic = BigInt(Math.round(this.maxPaymentUsdc * 1_000_000));
    const usdc = USDC_BY_CAIP2[caip2];
    client.registerPolicy(
      (_version, requirements) =>
        (requirements as PaymentRequirementLike[]).filter(r => {
          const amount = BigInt(r.amount ?? r.maxAmountRequired ?? "0");
          const assetMatches = caip2.startsWith("eip155:")
            ? r.asset?.toLowerCase() === usdc
            : r.asset === usdc;
          return r.network === caip2 && assetMatches && amount > 0n && amount <= capAtomic;
        }) as never,
    );

    return client;
  }

  /**
   * Runs a GET request with a timeout.
   *
   * @param f - The fetch implementation
   * @param url - The URL to request
   * @param headers - Request headers
   * @returns The response
   */
  private async timedFetch(
    f: typeof fetch,
    url: string,
    headers: Record<string, string>,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await f(url, { method: "GET", headers, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Parses a response body as JSON, falling back to truncated text.
   *
   * @param res - The response
   * @returns The parsed body
   */
  private async parseBody(res: Response): Promise<Record<string, unknown>> {
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" ? parsed : { value: parsed };
    } catch {
      return { text: text.slice(0, 2000) };
    }
  }

  /**
   * Decodes the base64 JSON payment-response header.
   *
   * @param header - The header value
   * @returns The decoded settlement details, or null
   */
  private decodePaymentResponse(header: string | null): Record<string, unknown> | null {
    if (!header) return null;
    try {
      const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
      const network = String(decoded.network ?? "");
      const tx = decoded.transaction ? String(decoded.transaction) : undefined;
      return {
        success: decoded.success,
        network,
        transaction: tx,
        explorerUrl: tx
          ? network.startsWith("solana")
            ? `https://solscan.io/tx/${tx}`
            : `https://basescan.org/tx/${tx}`
          : undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Builds a success result.
   *
   * @param route - The route called
   * @param url - The URL called
   * @param data - The response body
   * @param summarize - Builds a short summary
   * @param extra - Payment details
   * @returns A JSON string
   */
  private successResult(
    route: TradingSignalsRoute,
    url: string,
    data: Record<string, unknown>,
    summarize: (data: Record<string, unknown>) => string,
    extra: Record<string, unknown>,
  ): string {
    let summary: string;
    try {
      summary = summarize(data);
    } catch {
      summary = "See data for details.";
    }
    return JSON.stringify(
      {
        status: "success",
        summary,
        priceUsdc: route.priceUsd,
        ...extra,
        url,
        data,
        note: "Heuristic data from the Trading Signals Toolkit, not financial advice.",
      },
      null,
      2,
    );
  }

  /**
   * Builds an error result.
   *
   * @param error - Error code
   * @param message - Human readable message
   * @param extra - Extra fields
   * @returns A JSON string
   */
  private errorResult(error: string, message: string, extra: Record<string, unknown> = {}): string {
    return JSON.stringify({ status: "error", error, message, ...extra }, null, 2);
  }

  /**
   * Summarizes a token verdict response.
   *
   * @param d - The response body
   * @returns A one-line summary
   */
  private summarizeVerdict(d: Record<string, unknown>): string {
    const verdict = (d.verdict ?? {}) as Record<string, unknown>;
    const token = (d.token ?? {}) as Record<string, unknown>;
    const name = token.symbol ?? token.name ?? "token";
    const rating =
      greenLightLabel(verdict.rating) ?? String(verdict.rating ?? "unknown").toUpperCase();
    const grade = verdict.grade ? ` (grade ${verdict.grade})` : "";
    return `${name}: ${rating}${grade}`;
  }

  /**
   * Summarizes a pre-trade pack response.
   *
   * @param d - The response body
   * @returns A one-line summary
   */
  private summarizePack(d: Record<string, unknown>): string {
    const token = (d.token ?? {}) as Record<string, unknown>;
    const verdict = (token.verdict ?? {}) as Record<string, unknown>;
    const parts = [`Decision: ${d.decision ?? "unknown"}`];
    if (verdict.rating)
      parts.push(`token verdict ${greenLightLabel(verdict.rating) ?? verdict.rating}`);
    return parts.join(", ");
  }

  /**
   * Summarizes a whale flow response.
   *
   * @param d - The response body
   * @returns A one-line summary
   */
  private summarizeWhale(d: Record<string, unknown>): string {
    const s = (d.summary ?? {}) as Record<string, unknown>;
    const signal = String(s.signal ?? "unknown").replace(/_/g, " ");
    return `Whale signal: ${signal}; ${s.whaleBuys ?? 0} buys ($${s.whaleBuyUsd ?? 0}) vs ${s.whaleSells ?? 0} sells ($${s.whaleSellUsd ?? 0}), net $${s.netFlowUsd ?? 0}`;
  }
}

/**
 * Factory function to create a new TradingSignalsActionProvider instance.
 *
 * @param config - The configuration options for the provider
 * @returns A new TradingSignalsActionProvider
 */
export const tradingSignalsActionProvider = (config: TradingSignalsActionProviderConfig = {}) =>
  new TradingSignalsActionProvider(config);
