import { z } from "zod";

/**
 * Configuration options for X402stationActionProvider.
 */
export interface X402stationConfig {
  /**
   * Override the default oracle base URL.
   *
   * Allowed values: `https://x402station.io` (canonical, default) or any
   * `http(s)://localhost*` for development. Any other host is rejected at
   * construction time so a misconfigured agent can't sign x402 payments
   * against an attacker-controlled URL.
   */
  baseUrl?: string;
}

/**
 * Signal vocabulary returned by the oracle. Whitelisted at the schema
 * level so a typo in the agent's `signals` array doesn't silently never
 * fire (the route would 400, but catching it earlier saves a wallet
 * round-trip).
 *
 * Critical signals (those that flip preflight `ok` to `false`):
 *   `dead`, `zombie`, `decoy_price_extreme`, `dead_7d`, `mostly_dead`
 */
export const SignalEnum = z.enum([
  "unknown_endpoint",
  "no_history",
  "dead",
  "zombie",
  "decoy_price_extreme",
  "suspicious_high_price",
  "slow",
  "new_provider",
  "dead_7d",
  "mostly_dead",
  "slow_p99",
  "price_outlier_high",
  "high_concentration",
]);

/**
 * Input schema for the `preflight` and `forensics` actions.
 */
export const PreflightSchema = z.object({
  url: z
    .string()
    .url()
    .describe(
      "Full URL of the x402 endpoint the agent is about to pay (must be http(s)://, max 2048 chars).",
    ),
});

export const ForensicsSchema = PreflightSchema;

/**
 * Empty input — no parameters needed.
 */
export const CatalogDecoysSchema = z.object({}).describe("No parameters required");

/**
 * Input for the `alternatives` action — given a flagged URL OR a taskClass
 * hint, returns up to `limit` (default 5, max 10) healthy sibling endpoints
 * in the same provider / domain / category / price-band. Filtered to those
 * passing the same 1h + 7d health checks preflight uses; ranked by
 * uptime_7d_pct DESC then avg_latency_1h_ms ASC. At least one of `url` or
 * `taskClass` is required.
 */
export const AlternativesSchema = z
  .object({
    url: z
      .string()
      .url()
      .optional()
      .describe(
        "URL flagged by preflight (or otherwise rejected). Looked up in the catalog to extract provider / domain / category / price band as match keys.",
      ),
    taskClass: z
      .string()
      .max(80)
      .optional()
      .describe(
        "Service category hint (e.g. 'llm-completions', 'Inference'). Used as a fallback match key when `url` is unknown to the catalog, OR alone for category-only discovery.",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .describe("Max alternatives to return (1..10, default 5)."),
  })
  .refine((v) => v.url !== undefined || v.taskClass !== undefined, {
    message: "alternatives requires at least one of `url` or `taskClass`",
  });

/**
 * Input for `watch_subscribe`. Pays $0.01 USDC, returns a watchId + a 64-char
 * hex secret. The secret is the HMAC seed for verifying delivery payloads
 * and is only returned once — store it.
 */
export const WatchSubscribeSchema = z.object({
  url: z
    .string()
    .url()
    .describe("The x402 endpoint URL to watch."),
  webhookUrl: z
    .string()
    .url()
    .refine((u) => u.startsWith("https://"), {
      message:
        "webhookUrl must use HTTPS — HMAC-signed alert payloads must not travel in clear text",
    })
    .describe(
      "Where x402station will POST alert payloads. Must be HTTPS (HMAC-signed payloads must travel encrypted) and reachable from the public internet.",
    ),
  signals: z
    .array(SignalEnum)
    .min(1)
    .max(20)
    .optional()
    .describe(
      "Signal names to alert on. Defaults to ['dead', 'zombie', 'decoy_price_extreme'].",
    ),
});

/**
 * Input for `watch_status` and `watch_unsubscribe`. Both are free + secret-gated.
 */
export const WatchStatusSchema = z.object({
  watchId: z.string().uuid().describe("The watchId UUID returned by watch_subscribe."),
  secret: z
    .string()
    .length(64)
    .regex(/^[0-9a-f]{64}$/i, "secret must be 64 hex chars")
    .describe("The 64-char hex secret returned by watch_subscribe (store it; not retrievable later)."),
});

export const WatchUnsubscribeSchema = WatchStatusSchema;
