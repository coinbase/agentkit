import { z } from "zod";
import { SPRAAY_MAX_RECIPIENTS } from "./constants";

/**
 * Configuration options for the SpraayActionProvider.
 */
export interface SpraayActionProviderConfig {
  /**
   * Maximum x402 payment per gateway request, in USDC whole units.
   * Default: 1.0 (or SPRAAY_MAX_GATEWAY_PAYMENT_USDC env var).
   */
  maxGatewayPaymentUsdc?: number;

  /**
   * Optional pre-funded x402 payment header. When set, gateway requests send
   * this value in the X-PAYMENT header instead of signing a payment with the
   * wallet provider. Useful when payments are settled out-of-band.
   */
  x402PaymentHeader?: string;

  /**
   * Override for the Spraay gateway base URL. Defaults to the production
   * gateway; intended for testing and staging environments.
   */
  gatewayBaseUrl?: string;
}

const evmAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

const positiveDecimalString = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Amount must be a positive decimal number string")
  .refine(value => parseFloat(value) > 0, "Amount must be greater than zero");

/**
 * Adds a validation issue for every case-insensitive duplicate address.
 *
 * @param addresses - The list of addresses to check
 * @param ctx - The Zod refinement context to report issues on
 */
const checkNoDuplicateAddresses = (addresses: string[], ctx: z.RefinementCtx) => {
  const seen = new Set<string>();
  for (const address of addresses) {
    const normalized = address.toLowerCase();
    if (seen.has(normalized)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate recipient address: ${address}`,
      });
    }
    seen.add(normalized);
  }
};

const recipientAddresses = z
  .array(evmAddress)
  .min(1, "At least one recipient is required")
  .max(SPRAAY_MAX_RECIPIENTS, `Maximum ${SPRAAY_MAX_RECIPIENTS} recipients per transaction`)
  .superRefine(checkNoDuplicateAddresses)
  .describe("Array of recipient wallet addresses (e.g. ['0xABC...', '0xDEF...'])");

const preflightFlag = z
  .boolean()
  .optional()
  .describe(
    "When true, validate the batch against the free Spraay gateway pre-flight endpoint before signing. Pre-flight failures caused by gateway unavailability do not block the on-chain transaction.",
  );

/**
 * Schema for spraying ETH to multiple recipients.
 */
export const SprayEthSchema = z
  .object({
    recipients: recipientAddresses,
    amountPerRecipient: positiveDecimalString.describe(
      "Amount of ETH to send to each recipient, in whole units (e.g. '0.01' for 0.01 ETH)",
    ),
    preflight: preflightFlag,
  })
  .strip()
  .describe("Input schema for spraying ETH to multiple recipients in a single transaction");

/**
 * Schema for spraying ERC-20 tokens to multiple recipients.
 */
export const SprayTokenSchema = z
  .object({
    tokenAddress: evmAddress.describe("The ERC-20 token contract address"),
    recipients: recipientAddresses,
    amountPerRecipient: positiveDecimalString.describe(
      "Amount of tokens to send to each recipient, in whole units (e.g. '100' for 100 USDC)",
    ),
    preflight: preflightFlag,
  })
  .strip()
  .describe(
    "Input schema for spraying ERC-20 tokens to multiple recipients in a single transaction",
  );

/**
 * Schema for spraying ETH with variable amounts per recipient.
 */
export const SprayEthVariableSchema = z
  .object({
    recipients: recipientAddresses,
    amounts: z
      .array(positiveDecimalString)
      .min(1, "At least one amount is required")
      .describe(
        "Array of ETH amounts corresponding to each recipient, in whole units (e.g. ['0.01', '0.05'])",
      ),
    preflight: preflightFlag,
  })
  .strip()
  .describe(
    "Input schema for spraying variable amounts of ETH to multiple recipients in a single transaction",
  );

/**
 * Schema for spraying ERC-20 tokens with variable amounts per recipient.
 */
export const SprayTokenVariableSchema = z
  .object({
    tokenAddress: evmAddress.describe("The ERC-20 token contract address"),
    recipients: recipientAddresses,
    amounts: z
      .array(positiveDecimalString)
      .min(1, "At least one amount is required")
      .describe(
        "Array of token amounts corresponding to each recipient, in whole units (e.g. ['100', '50'])",
      ),
    preflight: preflightFlag,
  })
  .strip()
  .describe(
    "Input schema for spraying variable amounts of ERC-20 tokens to multiple recipients in a single transaction",
  );

const bpaRecipients = z
  .array(
    z.object({
      recipient: evmAddress.describe("Recipient wallet address"),
      amount: positiveDecimalString.describe(
        "Amount for this recipient, in whole token units (e.g. '1.00')",
      ),
    }),
  )
  .min(1, "At least one recipient is required")
  .max(SPRAAY_MAX_RECIPIENTS, `Maximum ${SPRAAY_MAX_RECIPIENTS} recipients per batch`)
  .superRefine((entries, ctx) =>
    checkNoDuplicateAddresses(
      entries.map(entry => entry.recipient),
      ctx,
    ),
  )
  .describe("Batch entries as (recipient, amount) pairs");

const bpaToken = z.string().min(1).describe("Token symbol for the batch (e.g. 'USDC' or 'ETH')");

const bpaChain = z.string().default("base").describe("Target chain identifier (default 'base')");

/**
 * Schema for validating a batch via the free Spraay gateway pre-flight endpoint.
 */
export const SpraayValidateBatchSchema = z
  .object({
    token: bpaToken,
    recipients: bpaRecipients,
    chain: bpaChain,
  })
  .strip()
  .describe("Input schema for validating a batch payment via the free Spraay gateway endpoint");

/**
 * Schema for estimating batch cost via the free Spraay gateway endpoint.
 */
export const SpraayEstimateBatchSchema = z
  .object({
    recipients: z
      .number()
      .int()
      .positive()
      .max(SPRAAY_MAX_RECIPIENTS, `Maximum ${SPRAAY_MAX_RECIPIENTS} recipients per batch`)
      .describe("Number of recipients in the batch (positive integer count)"),
    token: bpaToken,
    chain: bpaChain,
  })
  .strip()
  .describe(
    "Input schema for estimating batch execution cost via the free Spraay gateway endpoint",
  );

/**
 * Schema for executing a batch through the x402-metered Spraay gateway.
 */
export const SpraayExecuteBatchGatewaySchema = z
  .object({
    token: bpaToken,
    recipients: bpaRecipients,
    chain: bpaChain,
  })
  .strip()
  .describe("Input schema for executing a batch payment via the x402-metered Spraay gateway");

/**
 * Schema for creating an escrow through the x402-metered Spraay gateway.
 */
export const SpraayCreateEscrowSchema = z
  .object({
    token: bpaToken,
    amount: positiveDecimalString.describe("Escrow amount, in whole token units (e.g. '250.00')"),
    beneficiary: evmAddress.describe(
      "Wallet address that can receive the escrowed funds on release",
    ),
    chain: bpaChain,
    deadline: z
      .string()
      .optional()
      .describe("Optional ISO-8601 timestamp after which the escrow can be refunded"),
    description: z
      .string()
      .max(500)
      .optional()
      .describe("Optional human-readable description of the escrow terms"),
  })
  .strip()
  .describe("Input schema for creating an escrow via the x402-metered Spraay gateway");
