import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider, WalletProvider } from "../../wallet-providers";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { SearchSubgraphsSchema, GetSubgraphSchemaSchema, QuerySubgraphSchema } from "./schemas";
import { SEARCH_QUERY, INTROSPECT_QUERY, toFulltext, gqlBody, parseHits } from "./queries";
import {
  GRAPH_X402_GATEWAY_BASE,
  GRAPH_NETWORK_SUBGRAPH_ID,
  GRAPH_USDC_BASE,
  THE_GRAPH_SUPPORTED_NETWORKS,
  DEFAULT_MAX_PAYMENT_USDC,
} from "./constants";

/**
 * Configuration for the TheGraphActionProvider.
 */
export interface TheGraphConfig {
  /**
   * Per-query spend ceiling in whole USDC. A query whose 402 price exceeds this
   * is refused before any payment is signed. Defaults to the
   * THE_GRAPH_MAX_PAYMENT_USDC env var, then 1.0 USDC. Typical query is ~$0.01.
   */
  maxPaymentUsdc?: number;

  /**
   * Optional free GraphQL endpoint for discovery (search_subgraphs), e.g. a
   * curated subgraph registry. If unset, discovery runs a tiny paid x402 query
   * against The Graph's network subgraph.
   */
  registryUrl?: string;

  /**
   * Override the x402 gateway base URL.
   */
  gatewayBase?: string;
}

type PaidOutcome =
  | { ok: true; data: unknown; paidUsd: number }
  | { ok: false; error: Record<string, unknown> };

/**
 * TheGraphActionProvider lets an agent query The Graph directly and pay per
 * query from its own wallet over x402. It exposes discovery, schema
 * introspection, and paid GraphQL query actions across every subgraph on the
 * network. Discovery + query construction is ported from PayQL (Apache-2.0);
 * payment is signed with the agent's AgentKit wallet.
 *
 * @augments ActionProvider
 */
export class TheGraphActionProvider extends ActionProvider<WalletProvider> {
  private readonly maxPaymentUsdc: number;
  private readonly registryUrl?: string;
  private readonly gatewayBase: string;

  /**
   * Constructor for the TheGraphActionProvider.
   *
   * @param config - Configuration options for the provider
   */
  constructor(config: TheGraphConfig = {}) {
    super("thegraph", []);
    this.maxPaymentUsdc =
      config.maxPaymentUsdc ??
      parseFloat(process.env.THE_GRAPH_MAX_PAYMENT_USDC ?? String(DEFAULT_MAX_PAYMENT_USDC));
    this.registryUrl = config.registryUrl ?? process.env.THE_GRAPH_REGISTRY_URL;
    this.gatewayBase = config.gatewayBase ?? GRAPH_X402_GATEWAY_BASE;
  }

  /**
   * Discovers the best subgraphs for a plain-English data topic.
   *
   * @param walletProvider - The wallet provider (used to pay when no free registry is configured)
   * @param args - The search topic and optional result count
   * @returns A JSON string of ranked subgraph candidates, or an error
   */
  @CreateAction({
    name: "search_subgraphs",
    description: `
Finds the best subgraphs on The Graph for a plain-English data topic. Returns
ranked candidates (subgraph id, name, description, signal, query URL) so you can
pick one to introspect and query.

Costs a tiny x402 fee (~$0.01 USDC on Base) unless a free discovery registry is
configured. Use this first, then get_subgraph_schema, then query_subgraph.

Input: { "query": "uniswap v3 arbitrum", "first": 5 }`,
    schema: SearchSubgraphsSchema,
  })
  async searchSubgraphs(
    walletProvider: WalletProvider,
    args: z.infer<typeof SearchSubgraphsSchema>,
  ): Promise<string> {
    const body = gqlBody(SEARCH_QUERY, { text: toFulltext(args.query), first: args.first ?? 5 });

    // Free curated discovery source, if configured — no payment.
    if (this.registryUrl) {
      try {
        const res = await fetch(this.registryUrl, body);
        const raw = await res.json();
        return JSON.stringify({ success: true, source: "registry", subgraphs: parseHits(raw) }, null, 2);
      } catch (error) {
        return this.errString("discovery via registry failed", error);
      }
    }

    // Default: a tiny paid query against The Graph's network subgraph.
    const outcome = await this.paidGraphFetch(walletProvider, this.subgraphUrl(GRAPH_NETWORK_SUBGRAPH_ID), body);
    if (!outcome.ok) return JSON.stringify(outcome.error, null, 2);
    return JSON.stringify(
      { success: true, source: "x402", paidUsd: outcome.paidUsd, subgraphs: parseHits(outcome.data) },
      null,
      2,
    );
  }

  /**
   * Returns a subgraph's queryable entities and their arguments.
   *
   * @param walletProvider - The wallet provider used to pay the x402 fee
   * @param args - The subgraph id to introspect
   * @returns A JSON string of entities/args, or an error
   */
  @CreateAction({
    name: "get_subgraph_schema",
    description: `
Returns a subgraph's top-level queryable entities and their arguments, so you can
write a correct query. Costs a tiny x402 fee (~$0.01 USDC on Base).

Input: { "subgraphId": "5zvR82..." }`,
    schema: GetSubgraphSchemaSchema,
  })
  async getSubgraphSchema(
    walletProvider: WalletProvider,
    args: z.infer<typeof GetSubgraphSchemaSchema>,
  ): Promise<string> {
    const outcome = await this.paidGraphFetch(
      walletProvider,
      this.subgraphUrl(args.subgraphId),
      gqlBody(INTROSPECT_QUERY),
    );
    if (!outcome.ok) return JSON.stringify(outcome.error, null, 2);
    const fields =
      ((outcome.data as { data?: { __type?: { fields?: Array<Record<string, unknown>> } } })?.data
        ?.__type?.fields) ?? [];
    const entities = fields
      .filter(f => typeof f.name === "string" && !(f.name as string).startsWith("_"))
      .map(f => ({
        name: f.name as string,
        args: ((f.args as Array<{ name: string }>) ?? []).map(a => a.name),
      }));
    return JSON.stringify({ success: true, paidUsd: outcome.paidUsd, entities }, null, 2);
  }

  /**
   * Runs a paid GraphQL query against a subgraph.
   *
   * @param walletProvider - The wallet provider used to pay the x402 fee
   * @param args - The subgraph id, GraphQL query, and optional variables
   * @returns A JSON string of the query result, or an error
   */
  @CreateAction({
    name: "query_subgraph",
    description: `
Runs a GraphQL query against a subgraph and auto-pays the per-query x402 fee
(~$0.01 USDC on Base) from the agent's wallet. Use get_subgraph_schema first to
see available entities/fields. A query priced above the configured
maxPaymentUsdc is refused before any payment.

Input: { "subgraphId": "5zvR82...", "query": "{ tokens(first: 5) { id symbol } }" }`,
    schema: QuerySubgraphSchema,
  })
  async querySubgraph(
    walletProvider: WalletProvider,
    args: z.infer<typeof QuerySubgraphSchema>,
  ): Promise<string> {
    const outcome = await this.paidGraphFetch(
      walletProvider,
      this.subgraphUrl(args.subgraphId),
      gqlBody(args.query, args.variables),
    );
    if (!outcome.ok) return JSON.stringify(outcome.error, null, 2);
    return JSON.stringify(
      { success: true, subgraphId: args.subgraphId, paidUsd: outcome.paidUsd, data: outcome.data },
      null,
      2,
    );
  }

  /**
   * Checks if the action provider supports the given network.
   * Payments settle in USDC on Base.
   *
   * @param network - The network to check
   * @returns True if the network is Base mainnet
   */
  supportsNetwork = (network: Network) =>
    (THE_GRAPH_SUPPORTED_NETWORKS as readonly string[]).includes(network.networkId!);

  /**
   * Builds the x402 gateway URL for a subgraph.
   *
   * @param subgraphId - The subgraph id
   * @returns The full gateway URL
   */
  private subgraphUrl(subgraphId: string): string {
    return `${this.gatewayBase}/subgraphs/id/${subgraphId}`;
  }

  /**
   * Fetches a GraphQL request against the x402 gateway: probes the 402 price,
   * enforces the per-query cap, and only then signs and pays from the wallet.
   *
   * @param walletProvider - The wallet provider used to sign the payment
   * @param url - The subgraph gateway URL
   * @param body - The GraphQL request body
   * @returns A structured outcome with the parsed data or an error
   */
  private async paidGraphFetch(
    walletProvider: WalletProvider,
    url: string,
    body: RequestInit,
  ): Promise<PaidOutcome> {
    if (!(walletProvider instanceof EvmWalletProvider)) {
      return {
        ok: false,
        error: {
          error: true,
          message: "Unsupported wallet provider",
          details: "The Graph x402 payments settle in USDC on Base and require an EvmWalletProvider.",
        },
      };
    }

    // Probe (unpaid) to read the 402 price before committing to a payment.
    let pre: Response;
    try {
      pre = await fetch(url, body);
    } catch (error) {
      return { ok: false, error: { error: true, message: "Request failed", details: String(error) } };
    }

    // No payment required (e.g. free registry, or an error page).
    if (pre.status !== 402) {
      const data = await pre.json().catch(() => null);
      return { ok: true, data, paidUsd: 0 };
    }

    const accepts = await this.parse402(pre);
    const option = this.pickCheapestUsdc(accepts);
    if (!option) {
      return {
        ok: false,
        error: { error: true, message: "No USDC-on-Base payment option offered by the gateway" },
      };
    }

    const priceUsd = Number(option.maxAmountRequired ?? option.amount ?? 0) / 1e6;
    if (!(priceUsd <= this.maxPaymentUsdc)) {
      return {
        ok: false,
        error: {
          error: true,
          message: "Payment exceeds limit",
          details: `Query price $${priceUsd} exceeds the configured maxPaymentUsdc of $${this.maxPaymentUsdc}.`,
          priceUsd,
          maxPaymentUsdc: this.maxPaymentUsdc,
        },
      };
    }

    // Within cap — sign and pay with the agent's wallet.
    try {
      const client = await this.createX402Client(walletProvider);
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);
      const paid = await fetchWithPayment(url, body);
      const data = await paid.json().catch(() => null);
      if (paid.status !== 200) {
        return {
          ok: false,
          error: {
            error: true,
            message: `Query failed with status ${paid.status}. Payment was not settled.`,
            data,
          },
        };
      }
      return { ok: true, data, paidUsd: priceUsd };
    } catch (error) {
      return { ok: false, error: { error: true, message: "Paid query failed", details: String(error) } };
    }
  }

  /**
   * Parses the x402 payment requirements from a 402 response (header first, then body).
   *
   * @param res - The 402 fetch Response
   * @returns The `accepts` array of payment options
   */
  private async parse402(res: Response): Promise<Array<Record<string, unknown>>> {
    let accepts: Array<Record<string, unknown>> = [];
    const header = res.headers.get("payment-required") ?? res.headers.get("x-payment-required");
    if (header) {
      try {
        accepts = (JSON.parse(atob(header)).accepts as Array<Record<string, unknown>>) ?? [];
      } catch {
        // fall through to body
      }
    }
    if (accepts.length === 0) {
      const bodyJson = (await res.json().catch(() => ({}))) as { accepts?: Array<Record<string, unknown>> };
      accepts = bodyJson.accepts ?? [];
    }
    return accepts;
  }

  /**
   * Picks the cheapest `exact`/USDC-on-Base payment option from a 402's accepts.
   *
   * @param accepts - The payment options from the 402
   * @returns The cheapest matching option, or undefined
   */
  private pickCheapestUsdc(
    accepts: Array<Record<string, unknown>>,
  ): Record<string, unknown> | undefined {
    if (!Array.isArray(accepts) || accepts.length === 0) return undefined;
    const exact = accepts.filter(a => String(a.scheme ?? "").toLowerCase() === "exact");
    const pool = exact.length ? exact : accepts;
    const usdc = pool.filter(a => String(a.asset ?? "").toLowerCase() === GRAPH_USDC_BASE.toLowerCase());
    const finalPool = usdc.length ? usdc : pool;
    const onBase = finalPool.filter(a => {
      const n = String(a.network ?? "").toLowerCase();
      return n === "eip155:8453" || n === "base" || n === "base-mainnet" || n === "8453";
    });
    const candidates = onBase.length ? onBase : finalPool;
    return [...candidates].sort(
      (a, b) =>
        Number(a.maxAmountRequired ?? a.amount ?? 0) - Number(b.maxAmountRequired ?? b.amount ?? 0),
    )[0];
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
   * Formats a caught error as a JSON string.
   *
   * @param message - A human message
   * @param error - The caught error
   * @returns A JSON error string
   */
  private errString(message: string, error: unknown): string {
    return JSON.stringify(
      { error: true, message, details: error instanceof Error ? error.message : String(error) },
      null,
      2,
    );
  }
}

/**
 * Factory function to create a new TheGraphActionProvider instance.
 *
 * @param config - Configuration options for the provider
 * @returns A new TheGraphActionProvider
 */
export const theGraphActionProvider = (config: TheGraphConfig = {}) =>
  new TheGraphActionProvider(config);
