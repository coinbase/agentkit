import { z } from "zod";

/**
 * Input schema for registering a Basename.
 */
export const RegisterBasenameSchema = z
  .object({
    basename: z.string().describe("The Basename to assign to the agent"),
    amount: z.string().default("0.002").describe("The amount of ETH to pay for registration"),
  })
  .strip()
  .describe("Instructions for registering a Basename");
