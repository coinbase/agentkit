import { z } from "zod";

/**
 * Input schema for signing a digest (raw 32-byte hash)
 */
export const SignDigestSchema = z
  .object({
    digest: z
      .string()
      .describe(
        "The 32-byte digest to sign, as a hex string (64 characters, with or without 0x prefix)",
      ),
  })
  .strip()
  .describe("Input schema for signing a raw digest for external multisig coordination");

/**
 * Input schema for signing EIP-712 typed data (for Safe multisig)
 */
export const SignSafeTransactionSchema = z
  .object({
    safeAddress: z.string().describe("The Safe multisig contract address"),
    safeTxHash: z
      .string()
      .describe("The Safe transaction hash to sign (32 bytes hex, with or without 0x prefix)"),
  })
  .strip()
  .describe("Input schema for signing a Safe (Gnosis Safe) transaction hash");

/**
 * Input schema for getting the agent's public key
 */
export const GetPublicKeySchema = z
  .object({})
  .strip()
  .describe("Input schema for getting the agent's public key for multisig coordination");
