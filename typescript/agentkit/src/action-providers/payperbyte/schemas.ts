import { z } from "zod";

// --- Config ---

/**
 * Configuration for PayperbyteActionProvider.
 */
export interface PayperbyteConfig {
  /**
   * Maximum USDC (whole units) this provider will spend on a single feed query. Defaults to
   * 1.0, matching the default cap used by the built-in x402 action provider.
   */
  maxPaymentUsdc?: number;
  /**
   * Base URL for the PayPerByte x402 gateway. Defaults to https://x402.payperbyte.io — override
   * only for testing against a different deployment.
   */
  baseUrl?: string;
  /**
   * CONSENSUS-CRITICAL override for the attestation's chainId/verifyingContract, for a future
   * coordinated migration of the BYTE Library domain ONLY. Defaults to the pinned constants
   * (chainId 421614, verifyingContract 0x44729bB148F46d8Db509E47b0453edc271e06e95). The domain
   * NAME ("BYTE Library") and version ("1") are never overridable — do not set this unless you
   * are deliberately migrating the domain and know the new values are correct; getting this
   * wrong silently changes which signatures verification will accept.
   */
  attestationDomain?: {
    chainId: number;
    verifyingContract: string;
  };
  /**
   * If set, `payperbyte_verify_attestation`'s `verified` additionally requires the recovered
   * signer to be one of these addresses (case-insensitive). If unset, verification only proves
   * that SOME key correctly signed the exact bytes under the pinned BYTE Library domain — it
   * does not by itself prove that key belongs to a legitimate PayPerByte publisher. The result
   * always includes `recoveredSigner` and `publisherTrusted` (true/false when this is set, null
   * when it is not) so callers can apply their own publisher policy either way.
   */
  trustedPublishers?: string[];
}

// --- Catalog (free) ---

export const ListFeedsSchema = z
  .object({})
  .describe(
    "List the PayPerByte feed catalog: feed ids, descriptions, and USDC prices. This is a free, " +
      "unauthenticated GET — no payment is made and no wallet is required.",
  );

// --- Paid query ---

export const QueryFeedSchema = z
  .object({
    feedId: z
      .string()
      .min(1)
      .describe(
        "The id of the feed to query, from payperbyte_list_feeds (e.g. 'weather', 'earthquakes').",
      ),
    queryParams: z
      .record(z.string(), z.string())
      .nullable()
      .describe("Optional query-string parameters to append to the feed's GET request."),
  })
  .describe(
    "Query a PayPerByte feed. This makes an x402-paid GET request (USDC on Base) and returns the " +
      "response body together with its X-BYTE-Attestation header verbatim, so the result can be " +
      "checked with payperbyte_verify_attestation before being acted on.",
  );

// --- Offline verification ---

const AttestationDomainSchema = z.object({
  name: z.string(),
  version: z.string(),
  chainId: z.number(),
  verifyingContract: z.string(),
});

export const AttestationSchema = z
  .object({
    alg: z.string().nullable(),
    domain: AttestationDomainSchema,
    publisher: z.string(),
    payloadHash: z.string(),
    payloadLength: z.number(),
    deadline: z.number(),
    signature: z.string(),
  })
  .describe(
    "The parsed X-BYTE-Attestation header — pass it exactly as returned by payperbyte_query_feed " +
      "(or as parsed JSON from that header on any other BYTE Library-attested response).",
  );

export const VerifyAttestationSchema = z
  .object({
    body: z
      .string()
      .describe(
        "The exact response body string the attestation was computed over — verbatim, not " +
          "re-serialized (whitespace and key order matter for the hash to match).",
      ),
    attestation: AttestationSchema,
  })
  .describe(
    "Offline verification of a BYTE Library X-BYTE-Attestation receipt: recomputes keccak256 of " +
      "the exact body bytes, checks it against the attested payloadHash and payloadLength, and " +
      "recovers the EIP-712 signer to confirm it matches the claimed publisher and has not expired. " +
      "Makes no network call. This proves the exact bytes were signed by the claimed publisher — it " +
      "is evidence toward authenticity and tamper-evidence, not a claim that the underlying data is " +
      "correct.",
  );
