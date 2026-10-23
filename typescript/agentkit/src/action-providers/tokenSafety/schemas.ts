import { z } from "zod";
import { TOKEN_SAFETY_CHAINS } from "./constants";

/**
 * Input schema for the check_token_safety action.
 */
export const CheckTokenSafetySchema = z
  .object({
    address: z
      .string()
      .describe(
        "The token's contract address (0x... on EVM chains) or mint address (base58 on Solana)",
      ),
    chain: z
      .enum(TOKEN_SAFETY_CHAINS)
      .optional()
      .describe(
        "The chain the token is on. Defaults to solana for base58 addresses and base for 0x addresses",
      ),
    since: z
      .string()
      .optional()
      .describe(
        "A watch.fingerprint from an earlier check of the same token, to get what changed since then",
      ),
  })
  .strip()
  .describe("Instructions for checking a token's risk");

/**
 * Configuration for the token safety action provider.
 */
export interface TokenSafetyConfig {
  /** Refuse checks priced above this many USDC. Defaults to 0.05. */
  maxPaymentUsdc?: number;
  /** Override the endpoint URL. */
  endpoint?: string;
}
