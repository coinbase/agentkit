import { z } from "zod";

/**
 * Input schema for the token_verdict_check action.
 */
export const TokenVerdictSchema = z
  .object({
    address: z
      .string()
      .regex(
        /^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/,
        "Must be a Base/Arbitrum ERC-20 address (0x + 40 hex) or a Solana base58 mint.",
      )
      .describe("The token to screen: a Base/Arbitrum 0x… address or a Solana base58 mint."),
    chain: z
      .enum(["base", "arbitrum", "solana"])
      .optional()
      .describe("Which chain the token is on. Default base; a base58 token implies solana."),
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
