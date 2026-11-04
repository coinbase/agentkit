import { z } from "zod";

const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address format")
  .describe("The 0x-prefixed 40-character hexadecimal EVM address to inspect on Base");

/**
 * Input schema for Tereno contract guard check.
 */
export const TerenoCheckContractSchema = z
  .object({
    address: addressSchema.describe(
      "Target smart contract address on Base to verify before execution",
    ),
  })
  .strict();

/**
 * Input schema for Tereno token metadata query.
 */
export const TerenoGetTokenMetadataSchema = z
  .object({
    address: addressSchema.describe(
      "Base ERC-20 token address to inspect for verified metadata and total supply",
    ),
  })
  .strict();

/**
 * Input schema for Tereno chain snapshot query.
 */
export const TerenoGetChainSnapshotSchema = z.object({}).strict();

/**
 * Input schema for Tereno prediction evidence query.
 */
export const TerenoGetPredictionEvidenceSchema = z
  .object({
    question: z
      .string()
      .min(5)
      .max(2000)
      .describe("Prediction market question or proposition to fetch machine-readable evidence for"),
    market: z
      .string()
      .optional()
      .describe(
        "Optional prediction market venue identifier (e.g., 'polymarket', 'kalshi', 'omen')",
      ),
    marketUrl: z
      .string()
      .url()
      .optional()
      .describe("Optional URL of the market proposition for resolution rule extraction"),
  })
  .strict();

/**
 * Input schema for Tereno quote capability action.
 */
export const TerenoQuoteContractGuardSchema = z
  .object({
    address: addressSchema.describe("Target contract address to get a preflight cost quote for"),
  })
  .strict();

/**
 * Input schema for Tereno list capabilities action.
 */
export const TerenoListCapabilitiesSchema = z.object({}).strict();

/**
 * Input schema for Tereno list bounties action.
 */
export const TerenoListBountiesSchema = z
  .object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe("Maximum number of open unseeded demand bounties to return (default 20)"),
  })
  .strict();

/**
 * Input schema for Tereno publish contract fingerprint action.
 */
export const TerenoPublishContractFingerprintSchema = z
  .object({
    address: addressSchema.describe("Contract address whose fingerprint was computed"),
    bytecodeHash: z
      .string()
      .regex(/^0x[a-fA-F0-9]{64}$/, "Must be a 32-byte hex hash")
      .nullable()
      .describe("SHA-256 or keccak hash of the bytecode, or null if unverified"),
    bytecodeBytes: z
      .number()
      .int()
      .nonnegative()
      .describe("Size of the compiled bytecode in bytes"),
    computedAtBlock: z
      .number()
      .int()
      .positive()
      .describe("Block number at which the bytecode fingerprint was verified"),
    agentId: z
      .string()
      .regex(/^\d+$/)
      .optional()
      .describe("Optional canonical ERC-8004 agent ID of the publishing agent"),
    registerIfMissing: z
      .boolean()
      .optional()
      .describe("Whether to register an ERC-8004 identity if not yet registered"),
  })
  .strict();
