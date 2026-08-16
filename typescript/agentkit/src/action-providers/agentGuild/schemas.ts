import { z } from "zod";

const EvmAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Must be an exact EVM address");

const AtomicAmountSchema = z
  .string()
  .regex(/^[0-9]+$/, "Must be a positive atomic-unit integer string")
  .refine(value => BigInt(value) > 0n, "Must be greater than zero");

const ResourceUrlSchema = z
  .string()
  .url()
  .max(2048)
  .refine(value => {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password
    );
  }, "Must be an HTTP(S) URL without embedded credentials");

export const PreflightAgentEndpointSchema = z
  .object({
    endpoint: ResourceUrlSchema.describe(
      "Exact public A2A or MCP operational endpoint to check, such as https://agent.example/a2a",
    ),
  })
  .strip()
  .describe("Run a free, read-only live preflight on one autonomous-agent endpoint");

/** Exact x402 v2 option returned by Agent Guild's Base-mainnet quote. */
export const AgentGuildPaymentOptionSchema = z
  .object({
    scheme: z.literal("exact"),
    network: z.literal("eip155:8453"),
    asset: EvmAddressSchema,
    amount: AtomicAmountSchema,
    payTo: EvmAddressSchema,
    maxTimeoutSeconds: z.number().int().positive().optional(),
    extra: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .describe("The exact Base-mainnet x402 v2 payment option from the matching quote action");

const TrustRequestShape = {
  capability: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .describe("Capability the agent must be trustworthy to perform, such as code-review"),
  signed: z
    .boolean()
    .nullable()
    .transform(value => value ?? false)
    .describe("Whether to request an offline-verifiable signed AGD-1 decision"),
  ttlSeconds: z
    .number()
    .int()
    .min(60)
    .max(604800)
    .nullable()
    .transform(value => value ?? 3600)
    .describe("Validity window for a signed decision, in seconds"),
};

export const QuoteAgentTrustSchema = z
  .object(TrustRequestShape)
  .strip()
  .describe("Request an unpaid Agent Guild trust-decision quote");

export const PurchaseAgentTrustSchema = z
  .object({
    ...TrustRequestShape,
    selectedPaymentOption: AgentGuildPaymentOptionSchema,
    confirmPayment: z
      .literal(true)
      .describe("Must be true only after the exact quote and spend have been approved"),
  })
  .strip()
  .describe("Purchase an Agent Guild trust decision using an exact prior quote");

const PaymentSafetyRequestShape = {
  asset: EvmAddressSchema.describe("Token contract for the contemplated Base-mainnet payment"),
  amount: AtomicAmountSchema.describe("Payment amount in the token's atomic units"),
  payTo: EvmAddressSchema.describe("Exact counterparty wallet that would receive payment"),
  resource: ResourceUrlSchema.describe("Exact job or resource URL the payment would buy"),
  capability: z
    .string()
    .trim()
    .max(128)
    .nullable()
    .describe("Optional capability the counterparty must advertise"),
  maxRisk: z
    .number()
    .min(0)
    .max(100)
    .nullable()
    .transform(value => value ?? 32.99)
    .describe("Maximum acceptable Agent Guild risk score; lower is stricter"),
  minConfidence: z
    .number()
    .min(0)
    .max(1)
    .nullable()
    .transform(value => value ?? 0.5)
    .describe("Minimum acceptable evidence confidence; higher is stricter"),
  ttlSeconds: z
    .number()
    .int()
    .min(60)
    .max(3600)
    .nullable()
    .transform(value => value ?? 300)
    .describe("Validity window for the signed AGPD-1 decision, in seconds"),
};

export const QuotePaymentSafetySchema = z
  .object(PaymentSafetyRequestShape)
  .strip()
  .describe("Request an unpaid quote for an exact Agent Guild payment-safety decision");

export const PurchasePaymentSafetySchema = z
  .object({
    ...PaymentSafetyRequestShape,
    selectedPaymentOption: AgentGuildPaymentOptionSchema,
    confirmPayment: z
      .literal(true)
      .describe("Must be true only after the exact quote and spend have been approved"),
  })
  .strip()
  .describe("Purchase a signed AGPD-1 payment-safety decision using an exact prior quote");
