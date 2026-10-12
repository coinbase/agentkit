import { z } from "zod";

// Pure (no DNS) host check for `webhookUrl` on watch_subscribe. Fails
// fast LOCAL when the operator passes a private/loopback/cloud-metadata
// host, before the call reaches the x402station server (which has its
// own SSRF guard at /api/v1/watch). Defense-in-depth, audit-2026-04-29
// recon-7 HIGH-8.
function isPrivateIPv4(ip: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return false;
  const a = Number.parseInt(m[1]!, 10);
  const b = Number.parseInt(m[2]!, 10);
  const c = Number.parseInt(m[3]!, 10);
  const d = Number.parseInt(m[4]!, 10);
  if ([a, b, c, d].some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}
function isPrivateIPv6(host: string): boolean {
  let h = host.toLowerCase();
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
  if (h === "::" || h === "::1") return true;
  if (/^fe[89ab]/.test(h)) return true;
  if (/^f[cd]/.test(h)) return true;
  if (/^ff/.test(h)) return true;
  if (h.startsWith("::ffff:")) return true;
  if (h.startsWith("::") && h.length > 2 && /^::[0-9a-f]/.test(h)) return true;
  if (h.startsWith("64:ff9b:")) return true;
  if (h.startsWith("100:")) return true;
  if (h.startsWith("2001:db8")) return true;
  if (/^3fff/.test(h)) return true;
  if (h.startsWith("2001:2:") || h.startsWith("2001:0002:")) return true;
  if (h.startsWith("5f00:")) return true;
  if (h.startsWith("2002:")) return true;
  if (h.startsWith("2001::") || /^2001:0+:/.test(h)) return true;
  return false;
}
const LOCALHOST_NAMES = new Set(["localhost", "localhost.localdomain"]);
/**
 * Returns the rejection reason as a string when `rawUrl` should be refused,
 * or `null` when the URL is acceptable for use as a webhookUrl.
 */
export function validateWebhookUrl(rawUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return "invalid URL";
  }
  if (u.protocol !== "https:") {
    return "webhookUrl must use HTTPS — HMAC-signed alert payloads must not travel in clear text";
  }
  if (u.username !== "" || u.password !== "") {
    return "webhookUrl must not contain userinfo (user:pass@host) — known phishing/spoofing vector";
  }
  const hostname = u.hostname.toLowerCase();
  if (LOCALHOST_NAMES.has(hostname)) {
    return `webhookUrl hostname is loopback (${hostname})`;
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) {
    if (isPrivateIPv4(hostname)) {
      return `webhookUrl IPv4 ${hostname} is loopback / private / link-local / cloud-metadata`;
    }
  }
  if (hostname.startsWith("[")) {
    if (isPrivateIPv6(hostname)) {
      return `webhookUrl IPv6 ${hostname} is loopback / ULA / link-local / v4-mapped / NAT64`;
    }
  }
  return null;
}

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
 * Input for the `buy_credits` action — buy a 1000-call preflight bundle for
 * $0.50 USDC. No parameters; price + bundle size are fixed in v1.
 */
export const BuyCreditsSchema = z
  .object({})
  .describe(
    "Buy 1000 prepaid /api/v1/preflight calls for $0.50 USDC. No parameters in v1.",
  );

/**
 * Input for the `credits_status` action — read a credit's balance + expiry.
 * UUID-only access; the creditId is the bearer token returned by buy_credits.
 */
export const CreditsStatusSchema = z.object({
  creditId: z
    .string()
    .uuid()
    .describe("The creditId UUID returned by buy_credits."),
});

/**
 * Input for the `whats_new` action — catalog diff polling. `since` is an ISO
 * 8601 timestamp (default = now() - 24h, cap 30 days back). `limit` caps each
 * of added_endpoints[] and removed_endpoints[] (1..500, default 200).
 */
export const WhatsNewSchema = z.object({
  since: z
    .string()
    .datetime()
    .optional()
    .describe(
      "ISO 8601 timestamp. Default = now() - 24h. Cannot be older than 30 days or in the future.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe(
      "Per-list cap (1..500, default 200). Applied independently to added_endpoints and removed_endpoints.",
    ),
});

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
    .superRefine((u, ctx) => {
      const reason = validateWebhookUrl(u);
      if (reason !== null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: reason });
      }
    })
    .describe(
      "Where x402station will POST alert payloads. Must be HTTPS, reachable from the public internet, and contain no userinfo. Loopback / private / link-local / cloud-metadata / IPv6 ULA / NAT64 / 6to4 hosts are rejected client-side.",
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
