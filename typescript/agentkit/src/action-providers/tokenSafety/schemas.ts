import { z } from "zod";

export const ScanTokenSchema = z
  .object({
    tokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The contract address of the token to scan for safety (e.g. '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')"),
    chain: z
      .string()
      .optional()
      .describe("The blockchain network the token resides on (e.g., 'base', 'ethereum', 'optimism', 'arbitrum', 'polygon', 'bsc'). Defaults to 'base'"),
  })
  .describe("Parameters for performing a token safety scan");
