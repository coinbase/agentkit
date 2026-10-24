import { z } from "zod";

/**
 * Input schema shared by every GROUNDTRUTH action: one address and an optional chain.
 */
export const GroundtruthAddressSchema = z
  .object({
    address: z
      .string()
      .min(1)
      .describe("The address to look up: a Solana base58 address, or a Robinhood Chain 0x address"),
    chain: z
      .enum(["solana", "rh"])
      .nullable()
      .optional()
      .describe(
        "The chain, 'solana' or 'rh' (Robinhood Chain). Leave it empty to infer it from the address format",
      ),
  })
  .strip()
  .describe("Input schema for a GROUNDTRUTH record lookup");
