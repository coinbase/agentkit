import { z } from "zod";

const evmAddress = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Expected 0x-prefixed 20-byte EVM address");

const hexHash64 = z.string().regex(/^[0-9a-f]{64}$/, "Expected 64-char lowercase hex SHA-256 hash");

const boundsRecord = z.record(
  z.string(),
  z.object({
    min: z.number().finite(),
    max: z.number().finite(),
  }),
);

/**
 * Input schema for verifying a counterparty on the Agent-Mediate Settlement Honours Roll.
 */
export const CheckHonoursSchema = z
  .object({
    subject: z
      .string()
      .min(1)
      .describe(
        "Counterparty root domain (e.g. vendor.example), did:web:vendor.example, or did:key:z6Mk... to verify on the Agent-Mediate Settlement Honours Roll ($0.00)",
      ),
  })
  .strip()
  .describe("Verify a counterparty's standing on the Agent-Mediate Settlement Honours Roll");

/**
 * Schema for x402r AuthCaptureEscrow metadata bound into a deterministic RFC 8785 JCS contractHash.
 */
export const X402rEscrowBindingSchema = z
  .object({
    escrowAddress: evmAddress.describe("Deployed x402r AuthCaptureEscrow contract address on Base"),
    operator: evmAddress.describe("Authorized escrow operator EVM address"),
    receiver: evmAddress.describe("Merchant or service-provider EVM address"),
    token: evmAddress
      .nullable()
      .transform(val => val ?? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
      .describe("ERC-20 token contract address (default: Base mainnet USDC)"),
    capturedAmountMicroUsdc: z
      .number()
      .int()
      .positive()
      .describe("Escrowed USDC amount in 6-decimal atomic units (e.g. 250000000 = 250.00 USDC)"),
    refundExpiry: z
      .number()
      .int()
      .positive()
      .describe("Unix timestamp (seconds) before which refundInEscrow may execute"),
    salt: z.string().min(1).describe("Unique x402r PaymentInfo salt"),
    jobId: z.string().min(1).describe("Upstream job, order, or invoice identifier"),
  })
  .strip()
  .describe("x402r AuthCaptureEscrow PaymentInfo metadata for deterministic contract binding");

/**
 * Input schema for filing an escrow or SLA dispute on Agent-Mediate.
 */
export const FileEscrowDisputeSchema = z
  .object({
    respondentId: z
      .string()
      .regex(/^did:key:z[1-9A-HJ-NP-Za-km-z]{32,128}$/, "Expected counterparty did:key")
      .describe(
        "Counterparty Ed25519 did:key (or Practice Bot did:key:z6Mkn42ijWNFD285Ru7xAfVPtVB1LRpmGe5f649fDwxPEanY for $0.00 testing)",
      ),
    escrow: X402rEscrowBindingSchema.nullable().describe(
      "Optional x402r AuthCaptureEscrow metadata; when provided, deterministically hashed via RFC 8785 JCS into contractHash",
    ),
    contractHash: hexHash64
      .nullable()
      .describe(
        "Optional precomputed 64-char hex RFC 8785 JCS contractHash (required if escrow is null)",
      ),
    claimSummary: z
      .string()
      .min(1)
      .max(2000)
      .describe("Concise factual summary of the SLA or delivery shortfall"),
    requestedRemedy: z
      .string()
      .min(1)
      .max(1000)
      .describe("Requested remedy (e.g. partial USDC refund + patch window)"),
    maxRefundMicroUsdc: z
      .number()
      .int()
      .positive()
      .describe(
        "Upper grid bound for refundMicroUsdc (must be <= capturedAmountMicroUsdc when escrow is provided)",
      ),
    refundStepMicroUsdc: z
      .number()
      .int()
      .positive()
      .nullable()
      .transform(val => val ?? 1_000_000)
      .describe("Grid step size in micro-USDC (default: 1000000 = 1.00 USDC)"),
    includeRemediationHours: z
      .boolean()
      .nullable()
      .transform(val => val ?? true)
      .describe(
        "Include a 2nd trade-off issue (remediationHours, 0..72h) to unlock integrative multi-issue settlements",
      ),
    minAcceptableRefundMicroUsdc: z
      .number()
      .int()
      .min(0)
      .nullable()
      .transform(val => val ?? 0)
      .describe("Minimum refund bound inside your principal mandate (default: 0)"),
    determinationConsent: z
      .boolean()
      .nullable()
      .transform(val => val ?? false)
      .describe("Opt in to contractual final-offer determination if sealed bargaining stalls"),
    requireDelivery: z
      .boolean()
      .nullable()
      .transform(val => val ?? false)
      .describe(
        "Verify live outbound notice delivery before creating dispute or settling any filing fee",
      ),
  })
  .strip()
  .describe("File a non-custodial sealed-offer dispute on Agent-Mediate");

/**
 * Input schema for submitting a monotone sealed offer in an open Agent-Mediate bargaining round.
 */
export const SubmitSealedOfferSchema = z
  .object({
    disputeId: z
      .string()
      .regex(/^dsp_[0-9a-f]{32}$/, "Expected dispute ID (dsp_...)")
      .describe("Agent-Mediate dispute identifier (dsp_...)"),
    round: z.number().int().min(1).describe("Open bargaining round number"),
    offer: z
      .record(z.string(), z.number().finite())
      .describe("Monotone sealed offer package (one numeric value per confirmed issue ID)"),
    weights: z
      .record(z.string(), z.number().min(0).max(1))
      .nullable()
      .describe(
        "Round-1 only: private issue weights summing to 1 (never disclosed to counterparty)",
      ),
    walkaway: z
      .record(z.string(), z.number().finite())
      .nullable()
      .describe(
        "Round-1 only: true worst acceptable package reservation utility (keep soft targets in offer/weights, not inflated here)",
      ),
    limits: boundsRecord
      .nullable()
      .describe(
        "Round-1 only, optional: strict non-negotiable per-issue red lines within mandate bounds. Pass null unless your principal explicitly mandated a hard per-issue cap/floor.",
      ),
    proposalResponse: z
      .enum(["accept", "reject"])
      .nullable()
      .describe(
        "Round 2+: accept or reject the open platform Nash proposal (settles only if both sides accept)",
      ),
  })
  .strip()
  .describe("Submit a sealed offer for an open Agent-Mediate bargaining round");

/**
 * Input schema for verifying a platform-signed Agent-Mediate settlement outcome.
 */
export const VerifyOutcomeSchema = z
  .object({
    disputeId: z
      .string()
      .regex(/^dsp_[0-9a-f]{32}$/, "Expected dispute ID (dsp_...)")
      .describe("Agent-Mediate dispute identifier (dsp_...)"),
    expectedContractHash: hexHash64
      .nullable()
      .describe("Optional expected JCS contractHash to assert before executing on-chain splits"),
    capturedAmountMicroUsdc: z
      .number()
      .int()
      .positive()
      .nullable()
      .describe(
        "Optional escrowed atomic amount; when provided, computes exact refundMicroUsdc and merchantReleaseMicroUsdc split",
      ),
  })
  .strip()
  .describe("Fetch and fail-closed verify an Agent-Mediate Ed25519Signature2026 outcome");
