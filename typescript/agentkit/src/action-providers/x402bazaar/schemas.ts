import { z } from "zod";

/**
 * Input schema for the token_verdict_check action.
 */
export const TokenVerdictSchema = z
  .object({
    address: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a Base ERC-20 token address (0x + 40 hex chars).")
      .describe("The Base (eip155:8453) ERC-20 token contract address to screen, e.g. 0x1234...abcd"),
    amountUsd: z
      .number()
      .positive()
      .optional()
      .describe(
        "Optional intended trade size in USD. Tunes the recommended max safe position size in the verdict.",
      ),
  })
  .describe("Input schema for an x402 Bazaar pre-trade token-verdict safety check");

/**
 * Configuration options for the X402BazaarActionProvider.
 */
export interface X402BazaarConfig {
  /**
   * Pay $0.03 USDC per call over x402 using the agent's wallet, instead of the
   * free daily tier. Requires an EVM wallet provider on Base. Default: false.
   */
  enablePayment?: boolean;
}
