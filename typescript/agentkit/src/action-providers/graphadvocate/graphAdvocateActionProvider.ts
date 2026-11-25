import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider, WalletProvider } from "../../wallet-providers";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import {
  PreviewSchema,
  RouteSchema,
  AskSchema,
  HyperliquidTraderScoreSchema,
  PolymarketTraderScoreSchema,
  AgentReputationSchema,
} from "./schemas";
import {
  GRAPH_ADVOCATE_BASE_URL,
  GRAPH_ADVOCATE_ENDPOINTS,
  GraphAdvocateEndpointKey,
  GRAPH_ADVOCATE_SUPPORTED_NETWORKS,
  DEFAULT_MAX_PAYMENT_USDC,
} from "./constants";

/**
 * Configuration for the GraphAdvocateActionProvider.
 */
export interface GraphAdvocateConfig {
  /**
   * Per-call spend ceiling in whole USDC. An action whose published price
   * exceeds this is refused before any payment is signed. Defaults to
   * GRAPH_ADVOCATE_MAX_PAYMENT_USDC env var, then 1.0 USDC.
   */
  maxPaymentUsdc?: number;

  /**
   * Override the Graph Advocate base URL (e.g. for a self-hosted instance).
   */
  baseUrl?: string;
}

/**
 * GraphAdvocateActionProvider gives an agent access to Graph Advocate's
 * onchain-data and intelligence endpoints. Start with the free `get_preview`
 * action (GET /preview). The paid `route` action (POST /route, $0.01 USDC)
 * returns formatted `result` rows plus `executed` and `query_ready`. Trader
 * and reputation score actions, and optional x402-settlements Q&A (`ask`),
 * auto-pay a small USDC fee on Base from the agent's wallet.
 *
 * @augments ActionProvider
 */
export class GraphAdvocateActionProvider extends ActionProvider<WalletProvider> {
  private readonly maxPaymentUsdc: number;
  private readonly baseUrl: string;

  /**
   * Constructor for the GraphAdvocateActionProvider.
   *
   * @param config - Configuration options for the provider
   */
  constructor(config: GraphAdvocateConfig = {}) {
    super("graphadvocate", []);
    this.maxPaymentUsdc =
      config.maxPaymentUsdc ??
      parseFloat(process.env.GRAPH_ADVOCATE_MAX_PAYMENT_USDC ?? String(DEFAULT_MAX_PAYMENT_USDC));
    this.baseUrl = config.baseUrl ?? GRAPH_ADVOCATE_BASE_URL;
  }

  /**
   * Free live top-3 preview of an onchain data question. No wallet or payment.
   *
   * @param _ - Unused wallet provider (preview is free and does not pay)
   * @param args - The plain-English question
   * @returns A JSON string with live preview rows, or an error
   */
  @CreateAction({
    name: "get_preview",
    description: `
Free live top-3 preview of an onchain data question (Uniswap, Aave, Compound,
ENS, Polymarket, and other subgraph-backed topics). Returns real rows when the
topic is recognized. No wallet and no payment required.

Use this first to inspect data. For the full list, other chains, filters, or a
follow-up, call the paid \`route\` action ($0.01 USDC).

Input: { "q": "uniswap v3 pools" }`,
    schema: PreviewSchema,
  })
  async getPreview(_: WalletProvider, args: z.infer<typeof PreviewSchema>): Promise<string> {
    try {
      const url = `${this.baseUrl}${GRAPH_ADVOCATE_ENDPOINTS.preview.path}?q=${encodeURIComponent(args.q)}`;
      const response = await fetch(url, { method: "GET" });
      const data = await this.parseResponseData(response);
      return JSON.stringify(
        {
          success: response.ok,
          endpoint: GRAPH_ADVOCATE_ENDPOINTS.preview.path,
          status: response.status,
          data,
        },
        null,
        2,
      );
    } catch (error) {
      return JSON.stringify(
        {
          error: true,
          message: "Graph Advocate preview request failed",
          details: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      );
    }
  }

  /**
   * Routes a plain-English onchain data question and returns live rows.
   *
   * @param walletProvider - The wallet provider used to pay the x402 fee
   * @param args - The question and optional execute flag
   * @returns A JSON string with result rows, query_ready, and executed, or an error
   */
  @CreateAction({
    name: "route",
    description: `
Routes a plain-English onchain data question (Uniswap, Aave, Compound, ENS,
Polymarket, 15.5K+ subgraphs) and returns formatted \`result\` rows, the
\`query_ready\` GraphQL/REST query, and \`executed\` gateway data.

Use after \`get_preview\` when you need the full list, other chains, filters,
or a follow-up. Costs $0.01 USDC on Base, auto-paid from the agent's wallet.
Payment only settles on HTTP 200.

Input: { "request": "uniswap v3 pools" }. Optional { "execute": false } skips
running the query (no \`result\` / \`executed\`; default is true).`,
    schema: RouteSchema,
  })
  async route(walletProvider: WalletProvider, args: z.infer<typeof RouteSchema>): Promise<string> {
    const body: Record<string, unknown> = { request: args.request };
    if (args.execute === false) {
      body.execute = false;
    }
    return this.paidPost(walletProvider, "route", body);
  }

  /**
   * Natural-language Q&A over the x402 Base settlements warehouse.
   *
   * @param walletProvider - The wallet provider used to pay the x402 fee
   * @param args - The settlements question
   * @returns A JSON string with the answer and sql_trace, or an error
   */
  @CreateAction({
    name: "ask_x402_settlements",
    description: `
Natural-language Q&A over the x402 Base settlements warehouse (not general
onchain protocol data — use \`route\` for Uniswap, Aave, etc.). Ask questions
like "Top 10 recipient addresses last 30 days". Returns {answer, sql_trace,
model, upstream_ms} so the SQL path can be verified.

Costs $0.05 USDC on Base, auto-paid from the agent's wallet. Payment only
settles on HTTP 200.

Input: { "question": "Top 10 recipient addresses last 30 days" }`,
    schema: AskSchema,
  })
  async askX402Settlements(
    walletProvider: WalletProvider,
    args: z.infer<typeof AskSchema>,
  ): Promise<string> {
    return this.paidPost(walletProvider, "ask", { question: args.question });
  }

  /**
   * Scores a wallet's Hyperliquid perps trading skill.
   *
   * @param walletProvider - The wallet provider used to pay the x402 fee
   * @param args - The wallet address to score
   * @returns A JSON string with the skill score and breakdown, or an error
   */
  @CreateAction({
    name: "get_hyperliquid_trader_score",
    description: `
Scores a wallet's Hyperliquid perps trading skill (0-100), derived from real
onchain trading history: win rate, Sharpe-like risk-adjusted return, liquidation
rate, and funding burn. Returns a classification (sharp / neutral / retail) and
supporting metrics.

Use before mirroring a copy-trade, ranking traders, or sizing exposure to a
counterparty. Costs $0.02 USDC on Base, auto-paid from the agent's wallet.

Input: { "wallet": "0x..." }`,
    schema: HyperliquidTraderScoreSchema,
  })
  async getHyperliquidTraderScore(
    walletProvider: WalletProvider,
    args: z.infer<typeof HyperliquidTraderScoreSchema>,
  ): Promise<string> {
    // Live API documents POST {user}; the handler also accepts {wallet}.
    return this.paidPost(walletProvider, "hyperliquid_trader_score", {
      user: args.wallet,
      wallet: args.wallet,
    });
  }

  /**
   * Scores a wallet's Polymarket trading skill.
   *
   * @param walletProvider - The wallet provider used to pay the x402 fee
   * @param args - The wallet address to score
   * @returns A JSON string with the skill score and breakdown, or an error
   */
  @CreateAction({
    name: "get_polymarket_trader_score",
    description: `
Scores a wallet's Polymarket prediction-market trading skill (0-100): a
Sharpe-weighted skill score with win rate, sample size, and realized/unrealized
PnL. Returns a classification (sharp / neutral / retail).

Use for batch-screening top holders of a market before entering, or vetting a
copy-trade target. Costs $0.01 USDC on Base, auto-paid from the agent's wallet.

Input: { "wallet": "0x..." }`,
    schema: PolymarketTraderScoreSchema,
  })
  async getPolymarketTraderScore(
    walletProvider: WalletProvider,
    args: z.infer<typeof PolymarketTraderScoreSchema>,
  ): Promise<string> {
    return this.paidPost(walletProvider, "polymarket_trader_score", { wallet: args.wallet });
  }

  /**
   * Scores an agent/wallet's onchain reputation.
   *
   * @param walletProvider - The wallet provider used to pay the x402 fee
   * @param args - The agent/wallet address to score
   * @returns A JSON string with the reputation score and signals, or an error
   */
  @CreateAction({
    name: "get_agent_reputation",
    description: `
Scores an agent or wallet's onchain reputation (0-100) from ground-truth signals
that resist gaming: ERC-8004 registration + age, IPFS metadata health, USDC
settlement velocity, and recency of paid activity. Returns a tier and the signal
breakdown.

Use before trusting, paying, or integrating with another agent. Costs $0.02
USDC on Base, auto-paid from the agent's wallet.

Input: { "wallet": "0x..." }`,
    schema: AgentReputationSchema,
  })
  async getAgentReputation(
    walletProvider: WalletProvider,
    args: z.infer<typeof AgentReputationSchema>,
  ): Promise<string> {
    return this.paidPost(walletProvider, "agent_reputation", { wallet: args.wallet });
  }

  /**
   * Checks if the action provider supports the given network.
   * Graph Advocate settles payments in USDC on Base.
   *
   * @param network - The network to check
   * @returns True if the network is Base mainnet
   */
  supportsNetwork = (network: Network) =>
    (GRAPH_ADVOCATE_SUPPORTED_NETWORKS as readonly string[]).includes(network.networkId!);

  /**
   * POSTs to a Graph Advocate x402 endpoint, auto-paying the fee from the
   * agent's wallet, and returns the JSON response as a string.
   *
   * @param walletProvider - The wallet provider used to sign the x402 payment
   * @param endpointKey - Which Graph Advocate endpoint to call
   * @param body - The JSON request body
   * @returns A JSON string with the result or a structured error
   */
  private async paidPost(
    walletProvider: WalletProvider,
    endpointKey: GraphAdvocateEndpointKey,
    body: Record<string, unknown>,
  ): Promise<string> {
    const endpoint = GRAPH_ADVOCATE_ENDPOINTS[endpointKey];

    // Enforce the per-call spend ceiling before signing anything.
    if (endpoint.priceUsdc > this.maxPaymentUsdc) {
      return JSON.stringify(
        {
          error: true,
          message: "Payment exceeds limit",
          details: `This action costs ${endpoint.priceUsdc} USDC, above the configured maxPaymentUsdc of ${this.maxPaymentUsdc}.`,
        },
        null,
        2,
      );
    }

    // Payments settle in USDC on Base, so an EVM wallet is required.
    if (!(walletProvider instanceof EvmWalletProvider)) {
      return JSON.stringify(
        {
          error: true,
          message: "Unsupported wallet provider",
          details:
            "Graph Advocate settles x402 payments in USDC on Base and requires an EvmWalletProvider.",
        },
        null,
        2,
      );
    }

    try {
      const client = await this.createX402Client(walletProvider);
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);
      const url = `${this.baseUrl}${endpoint.path}`;

      const response = await fetchWithPayment(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await this.parseResponseData(response);

      // Payment only settles on a 200.
      if (response.status !== 200) {
        return JSON.stringify(
          {
            success: false,
            message: `Request failed with status ${response.status}. Payment was not settled.`,
            endpoint: endpoint.path,
            status: response.status,
            data,
          },
          null,
          2,
        );
      }

      const paymentResponseHeader =
        response.headers.get("payment-response") ?? response.headers.get("x-payment-response");

      return JSON.stringify(
        {
          success: true,
          endpoint: endpoint.path,
          priceUsdc: endpoint.priceUsdc,
          paymentSettled: !!paymentResponseHeader,
          data,
        },
        null,
        2,
      );
    } catch (error) {
      return JSON.stringify(
        {
          error: true,
          message: "Graph Advocate request failed",
          details: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      );
    }
  }

  /**
   * Creates an x402 client configured to sign payments with the agent's wallet.
   * Mirrors AgentKit's x402 provider so signing behaves identically.
   *
   * @param walletProvider - The EVM wallet provider to sign with
   * @returns A configured x402Client
   */
  private async createX402Client(walletProvider: EvmWalletProvider): Promise<x402Client> {
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
    return client;
  }

  /**
   * Parses a fetch response by content type.
   *
   * @param response - The fetch Response object
   * @returns Parsed JSON or raw text
   */
  private async parseResponseData(response: Response): Promise<unknown> {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    return response.text();
  }
}

/**
 * Factory function to create a new GraphAdvocateActionProvider instance.
 *
 * @param config - Configuration options for the provider
 * @returns A new GraphAdvocateActionProvider
 */
export const graphAdvocateActionProvider = (config: GraphAdvocateConfig = {}) =>
  new GraphAdvocateActionProvider(config);
