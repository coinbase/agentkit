import { z } from "zod";
import { DEFAULT_TOKEN_CHAIN } from "./constants";

/**
 * Input schema for the Token Verdict action.
 */
export const TokenVerdictSchema = z
  .object({
    token: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Token must be a 20-byte EVM contract address")
      .describe(
        "The ERC-20 contract address to evaluate, e.g. 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      ),
    chain: z
      .string()
      .nullable()
      .transform(val => val ?? DEFAULT_TOKEN_CHAIN)
      .describe(
        "The chain the token is deployed on. Defaults to base. Examples: base, ethereum, arbitrum, optimism, polygon.",
      ),
  })
  .strip()
  .describe("Instructions for requesting a Token Verdict from Edge Signals");
