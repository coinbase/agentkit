import { z } from "zod";

/**
 * Input schema for checking the MainStreet onchain reputation of a Base address.
 */
export const CheckReputationSchema = z
  .object({
    address: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "must be a 0x-prefixed 40-hex Base address")
      .describe("The Base wallet, agent, or token-deployer address to check (0x...)."),
  })
  .strict();
