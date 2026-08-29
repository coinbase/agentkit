import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import {
  CatalogDecoysSchema,
  AlternativesSchema,
  WhatsNewSchema,
  BuyCreditsSchema,
  CreditsStatusSchema,
  ForensicsSchema,
  PreflightSchema,
  WatchStatusSchema,
  WatchSubscribeSchema,
  WatchUnsubscribeSchema,
  X402stationConfig,
} from "./schemas";

const DEFAULT_BASE_URL = "https://x402station.io";
const SUPPORTED_NETWORK_IDS = new Set(["base-mainnet", "base-sepolia"]);
// Per-call timeout so a stalled oracle doesn't hang the LLM step. 30s
// covers x402's 402 → sign → settle → JSON round-trip with margin.
// Greptile P2 (2026-04-27).
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Validates that the configured base URL points at the canonical
 * x402station.io domain (or a localhost dev URL). Any other value would
 * let a misconfigured agent sign x402 payments against an attacker-
 * controlled host. Same allow-list logic the official x402station-mcp
 * package uses.
 *
 * @param raw - User-supplied URL or undefined for the default.
 * @returns The validated URL with no trailing slash.
 */
function resolveBaseUrl(raw: string | undefined): string {
  const value = (raw ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    throw new Error(`x402station: baseUrl is not a valid URL: ${value}`);
  }
  // Canonical: `u.host` (NOT `u.hostname`) so a non-default port can't
  // bypass — `x402station.io:9999`.hostname is "x402station.io" but
  // `.host` keeps the port.
  const isCanonical = u.host === "x402station.io" && u.protocol === "https:";
  // localDev: `u.hostname` exact-match (NOT `u.host.startsWith(...)`)
  // so a host like `localhost.attacker.com` or `127.0.0.1.evil.example`
  // can't pass the loopback check via prefix. WHATWG `URL.hostname`
  // returns `[::1]` (with brackets per RFC 2732) for IPv6 literals.
  // CodeRabbit (mastra-ai/mastra#15804, 2026-04-27).
  const isLocalDev =
    (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]") &&
    (u.protocol === "http:" || u.protocol === "https:");
  if (!isCanonical && !isLocalDev) {
    throw new Error(
      `x402station: baseUrl must be https://x402station.io or a localhost dev URL; got "${value}". ` +
        "Refusing to sign x402 payments against an unknown host.",
    );
  }
  return value;
}

/**
 * X402stationActionProvider — pre-flight oracle for x402 endpoints.
 *
 * Six tools wrapping the x402station.io oracle API. Four are paid via
 * x402 (preflight $0.001, forensics $0.001, catalog_decoys $0.005,
 * watch_subscribe $0.01) and signed automatically through the agent's
 * configured EvmWalletProvider. Two are free + secret-gated and used
 * to manage an existing watch (watch_status, watch_unsubscribe).
 *
 * The oracle independently probes every active endpoint on the
 * agentic.market catalog every ~10 minutes and surfaces decoys, zombies,
 * dead services, and price-trap signals an agent should refuse to pay.
 *
 * Networks: Base mainnet (eip155:8453) and Base Sepolia (eip155:84532).
 *
 * Spec: https://x402station.io/.well-known/agent-skills (+ /skill.md)
 */
export class X402stationActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly baseUrl: string;

  /**
   * Creates a new instance of X402stationActionProvider.
   *
   * @param config - Optional configuration (custom base URL for dev).
   */
  constructor(config: X402stationConfig = {}) {
    super("x402station", []);
    this.baseUrl = resolveBaseUrl(config.baseUrl);
  }

  /**
   * Returns true for Base mainnet and Base Sepolia. The oracle accepts
   * USDC settlements on both; any other EVM network would 402-handshake
   * fine but the agent's payment wouldn't settle.
   *
   * @param network - The wallet's current network.
   * @returns Whether the oracle accepts payments on this network.
   */
  supportsNetwork(network: Network): boolean {
    return (
      network.protocolFamily === "evm" &&
      typeof network.networkId === "string" &&
      SUPPORTED_NETWORK_IDS.has(network.networkId)
    );
  }

  /**
   * Wraps `fetch` with the agent's wallet so a 402 from the oracle is
   * auto-signed and retried with X-PAYMENT. Same pattern the official
   * x402 ActionProvider in this repo uses — extracted so our actions
   * can reuse it without depending on the x402 provider directly.
   *
   * @param walletProvider - Agent's wallet (must be EVM, on a supported network).
   * @returns A fetch function that handles 402 → sign → retry transparently.
   */
  private async getPayingFetch(
    walletProvider: EvmWalletProvider,
  ): Promise<typeof fetch> {
    const client = new x402Client();
    const account = walletProvider.toSigner();
    const signer = {
      ...account,
      // Mirror the readContract surface that registerExactEvmScheme
      // uses to read the on-chain USDC contract for decimals/symbol.
      // The viem account from toSigner() lacks readContract, so we
      // delegate to the wallet provider's own implementation.
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
    return wrapFetchWithPayment(fetch, client);
  }

  /**
   * Issues a paid POST to the oracle. Reads response body as text first
   * so we can build a clear error message when nginx returns a 502/504
   * HTML body instead of JSON.
   *
   * @param walletProvider - Agent's wallet (will sign the 402 retry).
   * @param path - Oracle endpoint path (e.g. "/api/v1/preflight").
   * @param body - JSON body to POST.
   * @returns A JSON-stringified response with the oracle's payload + a
   *          `paymentReceipt` field decoded from the x-payment-response
   *          header so the agent can audit on-chain spend.
   */
  private async callPaid(
    walletProvider: EvmWalletProvider,
    path: string,
    body: unknown,
  ): Promise<string> {
    const fetchPay = await this.getPayingFetch(walletProvider);
    let r: Response;
    try {
      r = await fetchPay(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
    } catch (err) {
      const e = err as { name?: string };
      if (e.name === "AbortError" || e.name === "TimeoutError") {
        return JSON.stringify(
          {
            error: true,
            message: `x402station ${path} timed out after ${DEFAULT_TIMEOUT_MS}ms`,
          },
          null,
          2,
        );
      }
      throw err;
    }

    const receiptHeader =
      r.headers.get("x-payment-response") ?? r.headers.get("payment-response");
    let paymentReceipt: unknown = null;
    if (receiptHeader) {
      try {
        paymentReceipt = JSON.parse(atob(receiptHeader));
      } catch {
        // Greptile P2 (2026-04-27): explicit malformed flag so audit
        // code can branch on it instead of silently getting a stub
        // object that satisfies the type but lacks transaction/network/
        // payer fields.
        paymentReceipt = { raw: receiptHeader, malformed: true };
      }
    }

    const raw = await r.text();
    if (!r.ok) {
      const snippet = raw.length > 200 ? raw.slice(0, 200) + "…" : raw;
      return JSON.stringify(
        {
          error: true,
          status: r.status,
          message: `x402station ${path} returned ${r.status}`,
          details: snippet,
        },
        null,
        2,
      );
    }
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return JSON.stringify(
        {
          error: true,
          message: `x402station ${path} returned 200 with non-JSON body`,
          details: raw.slice(0, 200),
        },
        null,
        2,
      );
    }

    return JSON.stringify({ result: data, paymentReceipt }, null, 2);
  }

  /**
   * Issues a free, secret-gated request (GET or DELETE) to the oracle.
   * Used by watch_status and watch_unsubscribe.
   *
   * @param path - Oracle path (e.g. "/api/v1/watch/<uuid>").
   * @param method - HTTP method (GET or DELETE).
   * @param secret - 64-char hex secret returned by watch_subscribe.
   * @returns A JSON-stringified response.
   */
  private async callFree(
    path: string,
    method: "GET" | "DELETE",
    secret: string,
  ): Promise<string> {
    let r: Response;
    // Watch routes need x-x402station-secret. The credits-status route
    // (id-gated, secret-less) doesn't — pass an empty `secret` and we
    // skip the header so we don't ship "x-x402station-secret: "
    // (could trip a future strict-validation check).
    const headers: Record<string, string> = {};
    if (secret) headers["x-x402station-secret"] = secret;
    try {
      r = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });
    } catch (err) {
      const e = err as { name?: string };
      if (e.name === "AbortError" || e.name === "TimeoutError") {
        return JSON.stringify(
          {
            error: true,
            message: `x402station ${method} ${path} timed out after ${DEFAULT_TIMEOUT_MS}ms`,
          },
          null,
          2,
        );
      }
      throw err;
    }
    const raw = await r.text();
    if (!r.ok) {
      const snippet = raw.length > 200 ? raw.slice(0, 200) + "…" : raw;
      return JSON.stringify(
        {
          error: true,
          status: r.status,
          message: `x402station ${path} returned ${r.status}`,
          details: snippet,
        },
        null,
        2,
      );
    }
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return JSON.stringify(
        {
          error: true,
          message: `x402station ${path} returned 200 with non-JSON body`,
          details: raw.slice(0, 200),
        },
        null,
        2,
      );
    }
    return JSON.stringify(data, null, 2);
  }

  /**
   * Pre-flight safety check for a single x402 endpoint URL.
   *
   * @param walletProvider - Agent's wallet (signs the $0.001 payment).
   * @param args - The target URL.
   * @returns JSON-stringified `{ ok, warnings[], metadata }` plus payment receipt.
   */
  @CreateAction({
    name: "preflight",
    description:
      "Ask x402station whether a given x402 URL is safe to pay. Returns {ok, warnings[], metadata}. Costs $0.001 USDC (auto-signed via the wallet provider). Call this BEFORE any other paid x402 request to avoid decoys (price ≥ $1k USDC), zombie services, dead endpoints, and price/latency anomalies. ok:true only when no critical warning fires.",
    schema: PreflightSchema,
  })
  async preflight(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PreflightSchema>,
  ): Promise<string> {
    return this.callPaid(walletProvider, "/api/v1/preflight", { url: args.url });
  }

  /**
   * 7-day forensics report on one x402 endpoint.
   *
   * @param walletProvider - Agent's wallet (signs the $0.001 payment).
   * @param args - The target URL.
   * @returns JSON-stringified report with hourly uptime, latency p50/p90/p99,
   *          status-code distribution, concentration-group stats, decoy probability.
   */
  @CreateAction({
    name: "forensics",
    description:
      "Deep history report for one x402 endpoint: hourly uptime over 7 days, latency p50/p90/p99, status-code distribution, concentration-group stats (how crowded this provider's namespace is), and a decoy probability score [0, 1]. Costs $0.001 USDC. Superset of preflight — if you're running forensics you don't need preflight too.",
    schema: ForensicsSchema,
  })
  async forensics(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ForensicsSchema>,
  ): Promise<string> {
    return this.callPaid(walletProvider, "/api/v1/forensics", { url: args.url });
  }

  /**
   * Full known-bad blacklist as one JSON payload.
   *
   * @param walletProvider - Agent's wallet (signs the $0.005 payment).
   * @param _args - No parameters.
   * @returns JSON-stringified blacklist of every active endpoint flagged
   *          as decoy_price_extreme / zombie / dead_7d / mostly_dead.
   */
  @CreateAction({
    name: "catalog_decoys",
    description:
      "Returns every active x402 endpoint currently flagged decoy_price_extreme / zombie / dead_7d / mostly_dead in one JSON payload, plus per-reason counts. Costs $0.005 USDC. Pull periodically (hourly is plenty — internal data refreshes every 10 min) and cache locally as a blacklist — cheaper than preflighting every URL.",
    schema: CatalogDecoysSchema,
  })
  async catalogDecoys(
    walletProvider: EvmWalletProvider,
    _args: z.infer<typeof CatalogDecoysSchema>,
  ): Promise<string> {
    return this.callPaid(walletProvider, "/api/v1/catalog/decoys", {});
  }

  /**
   * Catalog diff polling — what was added / removed since `since`.
   *
   * @param walletProvider - Agent's wallet (signs the $0.001 payment).
   * @param args - { since?, limit? }. `since` defaults to now-24h on the
   *               server side; `limit` caps each of added_endpoints[] and
   *               removed_endpoints[] (1..500, default 200).
   * @returns JSON-stringified `{ since, until, window_hours,
   *          added_endpoints[], removed_endpoints[], summary,
   *          truncated, limit }`.
   */
  @CreateAction({
    name: "whats_new",
    description:
      "Catalog diff polling. Body { since?, limit? } (default since=now-24h, limit=200, max 500). Returns added_endpoints[] (first_seen_at >= since AND is_active=true), removed_endpoints[] (flipped to is_active=false since), service-level counts, polls_in_window, and current active totals. Costs $0.001 USDC. Designed for aggregator agents to poll hourly without breaking the bank — internal ingest cron runs every 5 min, so polling more often returns identical data.",
    schema: WhatsNewSchema,
  })
  async whatsNew(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof WhatsNewSchema>,
  ): Promise<string> {
    const body: Record<string, unknown> = {};
    if (args.since !== undefined) body.since = args.since;
    if (args.limit !== undefined) body.limit = args.limit;
    return this.callPaid(walletProvider, "/api/v1/whats-new", body);
  }

  /**
   * Buy 1000 prepaid /api/v1/preflight calls.
   *
   * @param walletProvider - Agent's wallet (signs the $0.50 payment).
   * @returns JSON-stringified `{ creditId, balance: 1000, initialBalance,
   *          paidAmount, payerAddress, createdAt, expiresAt, usage }`.
   *          STORE the creditId — bearer token, not retrievable later.
   *          Pass via X-Credit-Id header on subsequent /api/v1/preflight
   *          calls; on exhaustion/expiry the route falls through to
   *          per-call x402 automatically.
   */
  @CreateAction({
    name: "buy_credits",
    description:
      "Buy 1000 prepaid /api/v1/preflight calls for $0.50 USDC. Effective rate $0.0005/call (50% off the per-call $0.001 tier). Returns { creditId, balance, expiresAt }. STORE THE creditId — bearer token, not retrievable later. Pass via X-Credit-Id header on subsequent /api/v1/preflight calls; on exhaustion (balance=0) or expiry (90 days) the middleware falls through to per-call x402 automatically. Use this once you've decided to do high-volume preflight work.",
    schema: BuyCreditsSchema,
  })
  async buyCredits(
    walletProvider: EvmWalletProvider,
    _args: z.infer<typeof BuyCreditsSchema>,
  ): Promise<string> {
    return this.callPaid(walletProvider, "/api/v1/credits", {});
  }

  /**
   * Read a credit's balance + expiry. Free, id-gated.
   *
   * @param args - { creditId: uuid } returned by buy_credits.
   * @returns JSON-stringified `{ creditId, balance, initialBalance, used,
   *          paidAmount, createdAt, expiresAt, expired, paymentTx,
   *          paymentNetwork }`. 404 covers both malformed UUID and
   *          unknown credit (same body, anti-enumeration).
   */
  @CreateAction({
    name: "credits_status",
    description:
      "Read a credit's current balance + expiry. Free, no payment required. UUID-only access — anyone holding the creditId can read state, same as decrement. Returns 404 for unknown / malformed UUIDs (same response so an attacker scraping random UUIDs can't tell them apart).",
    schema: CreditsStatusSchema,
  })
  async creditsStatus(
    args: z.infer<typeof CreditsStatusSchema>,
  ): Promise<string> {
    return this.callFree(`/api/v1/credits/${args.creditId}`, "GET", "");
  }

  /**
   * Routing fallback — siblings to a flagged endpoint.
   *
   * @param walletProvider - Agent's wallet (signs the $0.005 payment).
   * @param args - { url?, taskClass?, limit? } — at least one of url/taskClass
   *               required; limit is 1..10, default 5.
   * @returns JSON-stringified `{ target, match_strategy, alternatives[],
   *          candidate_count }`. Each alternative carries url, service,
   *          provider, domain, category, price_usdc, uptime_1h_pct,
   *          uptime_7d_pct, avg_latency_1h_ms, match_reason.
   */
  @CreateAction({
    name: "alternatives",
    description:
      "Routing fallback. Given a URL flagged by preflight (or a taskClass hint), returns up to 5 healthy sibling endpoints in the same provider/domain/category/price-band. Filters out 7-day-dead and 1-hour-erroring candidates; ranks by uptime + latency. Costs $0.005 USDC. Use this immediately after preflight returns ok=false — it answers 'where do I go instead?'. Pass {url} when you have a specific URL the agent was about to pay; pass {taskClass} (e.g. 'llm-completions', 'Inference') when discovering by service category; or both for a richer match.",
    schema: AlternativesSchema,
  })
  async alternatives(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof AlternativesSchema>,
  ): Promise<string> {
    const body: Record<string, unknown> = {};
    if (args.url) body.url = args.url;
    if (args.taskClass) body.taskClass = args.taskClass;
    if (args.limit !== undefined) body.limit = args.limit;
    return this.callPaid(walletProvider, "/api/v1/alternatives", body);
  }

  /**
   * Subscribe to webhook alerts on x402 endpoint state changes.
   *
   * @param walletProvider - Agent's wallet (signs the $0.01 payment).
   * @param args - URL to watch, webhook URL, optional signal subset.
   * @returns JSON-stringified `{ watchId, secret, expiresAt, signals,
   *          alertsPaid, alertsRemaining, endpointKnown, deliveryFormat }`.
   *          The secret is the HMAC seed and is returned ONCE — store it.
   */
  @CreateAction({
    name: "watch_subscribe",
    description:
      "Pay $0.01 USDC for a 30-day watch + 100 prepaid alerts on one x402 endpoint. When subscribed signals fire or clear (e.g. zombie, decoy_price_extreme), x402station POSTs an HMAC-SHA256-signed JSON payload to your webhookUrl. Returns watchId + secret — STORE THE SECRET, it's the HMAC seed for verifying delivery payloads and is not retrievable later.",
    schema: WatchSubscribeSchema,
  })
  async watchSubscribe(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof WatchSubscribeSchema>,
  ): Promise<string> {
    const body: Record<string, unknown> = {
      url: args.url,
      webhookUrl: args.webhookUrl,
    };
    if (args.signals && args.signals.length > 0) body.signals = args.signals;
    return this.callPaid(walletProvider, "/api/v1/watch", body);
  }

  /**
   * Read-back the current state of a watch + recent alert deliveries.
   *
   * @param args - watchId UUID + 64-char hex secret.
   * @returns JSON-stringified watch metadata. No payment required.
   */
  @CreateAction({
    name: "watch_status",
    description:
      "Returns the current state of a watch: active/expired, alertsRemaining (out of 100 prepaid), last 10 alert deliveries with delivery_status, and the last computed signal snapshot. Free — no payment required, secret-gated by the secret returned from watch_subscribe.",
    schema: WatchStatusSchema,
  })
  async watchStatus(args: z.infer<typeof WatchStatusSchema>): Promise<string> {
    return this.callFree(`/api/v1/watch/${args.watchId}`, "GET", args.secret);
  }

  /**
   * Deactivate a watch — no further alerts will be queued or delivered.
   *
   * @param args - watchId UUID + 64-char hex secret.
   * @returns JSON-stringified `{ watchId, isActive: false, message }`.
   */
  @CreateAction({
    name: "watch_unsubscribe",
    description:
      "Deactivate a watch — no further alerts will be queued or delivered. Free — no payment required, secret-gated by the secret returned from watch_subscribe. The watch row + alert history are retained for audit. There is no refund for unused prepaid alerts.",
    schema: WatchUnsubscribeSchema,
  })
  async watchUnsubscribe(
    args: z.infer<typeof WatchUnsubscribeSchema>,
  ): Promise<string> {
    return this.callFree(`/api/v1/watch/${args.watchId}`, "DELETE", args.secret);
  }
}

/**
 * Factory helper.
 *
 * @param config - Optional custom base URL.
 * @returns A configured X402stationActionProvider.
 */
export function x402stationActionProvider(
  config: X402stationConfig = {},
): X402stationActionProvider {
  return new X402stationActionProvider(config);
}
