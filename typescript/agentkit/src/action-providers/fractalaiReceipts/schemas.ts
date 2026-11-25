import { z } from "zod";

/**
 * Configuration options for FractalaiReceiptsActionProvider.
 */
export interface FractalaiReceiptsConfig {
  /**
   * Maximum USDC (whole units) `request_x402_receipt` may pay for one notary seal.
   * Default: 0.005 (the notary's published price). A 402 asking for more is refused.
   */
  maxPaymentUsdc?: number;

  /**
   * Issuers accepted for `delivery-receipt` receipts in addition to the origin of the paid
   * resource (for example an independent notary). Never inferred from the receipt.
   */
  acceptedIssuers?: string[];

  /**
   * Governance keys (base64) pinned per `delivery-receipt` issuer origin, e.g.
   * `{ "https://api.example.com": ["<base64>"] }`. Without a pin, a third-party directory is
   * trusted on first use over HTTPS and the verdict reports `trustBasis: "tls"`.
   */
  pinnedIssuerGovernanceKeys?: Record<string, string[]>;

  /**
   * FractalAI key-directory epochs between the pinned checkpoint and the served epoch (parsed
   * JSON objects). Only needed once FractalAI publishes an epoch newer than the checkpoint.
   */
  directoryHistory?: unknown[];
}

/**
 * Input schema for verifying an x402 receipt.
 */
export const VerifyX402ReceiptSchema = z
  .object({
    receipt: z
      .string()
      .describe(
        "The receipt to verify, as the exact JSON text you received (do not re-serialize it). " +
          "Accepted: an x402 delivery-receipt wire object {alg, kid, payload, signature}, a " +
          "FractalAI notary seal {domain, content_id, body, public_key, signature}, a FractalAI " +
          "served proof {domain, route_id, digest, ...} or a FractalAI MIDAS alert {canonical, ...}.",
      ),
    kind: z
      .enum(["delivery-receipt", "x402-seal", "served-proof", "midas-alert"])
      .nullable()
      .describe(
        "The kind of receipt you expect. Set it when you know it: the verifier then refuses a " +
          "document of another kind. Null to infer the kind from the document's shape.",
      ),
    responseBody: z
      .string()
      .nullable()
      .describe(
        "Optional exact text of the response body that was served for the payment, to check the " +
          "body digest signed in the receipt (delivery-receipt and notary seals).",
      ),
    expectedTransaction: z
      .string()
      .nullable()
      .describe(
        "Optional settlement transaction hash you observed (e.g. from PAYMENT-RESPONSE); the " +
          "receipt must name the same transaction.",
      ),
    expectedPayer: z
      .string()
      .nullable()
      .describe("Optional payer address you observed; the receipt must name the same payer."),
    keyDirectory: z
      .string()
      .nullable()
      .describe(
        "Optional copy of the issuer's key directory (JSON text) for offline verification. " +
          "Null to fetch it. A FractalAI directory is always checked against the pinned " +
          "governance key and checkpoint, whatever its source.",
      ),
  })
  .strict()
  .describe("Instructions for verifying a signed x402 receipt");

/**
 * Input schema for requesting an independent FractalAI notary seal of an x402 payment.
 */
export const RequestX402ReceiptSchema = z
  .object({
    transaction: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/, "must be a 0x-prefixed 32-byte transaction hash")
      .describe("Transaction hash of the x402 settlement to notarize (Base mainnet)."),
    payTo: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/, "must be an EVM address")
      .describe("Recipient (payTo) of the x402 payment being notarized."),
    amount: z
      .string()
      .regex(/^[1-9][0-9]{0,77}$/, "must be a positive integer string in atomic units")
      .describe("Amount paid, in atomic units of the asset (e.g. '10000' = 0.01 USDC)."),
    asset: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/, "must be an EVM address")
      .nullable()
      .describe("Asset contract of the payment. Null for USDC on Base."),
    payer: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/, "must be an EVM address")
      .nullable()
      .describe(
        "Payer you believe made the payment. The notary replaces it with the sender it derives " +
          "on-chain; a different value is reported.",
      ),
    resource: z
      .string()
      .url()
      .nullable()
      .describe("URL of the resource that was paid for (carried in the seal, not checked)."),
    responseBody: z
      .string()
      .nullable()
      .describe(
        "Optional exact text of the response body you received; its SHA-256 is sealed as " +
          "response_sha256 (a claim of the requester, not checked by the notary).",
      ),
  })
  .strict()
  .describe("Instructions for requesting an independent notary seal of an x402 payment");
