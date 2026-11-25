import { z } from "zod";
import { TOKEN_CHAINS } from "./constants";

/**
 * Configuration for the AgentsvcActionProvider
 */
export interface AgentsvcConfig {
  /**
   * Maximum payment per call in whole USDC. Calls that ask for more are refused before signing.
   * Default: 0.05 (or AGENTSVC_MAX_PAYMENT_USDC env var)
   */
  maxPaymentUsdc?: number;
}

/**
 * Input schema for the token risk check
 */
export const CheckTokenRiskSchema = z
  .object({
    token: z
      .string()
      .min(32)
      .max(64)
      .describe("Token contract address (0x...) or Solana mint address"),
    chain: z
      .enum(TOKEN_CHAINS)
      .default("base")
      .describe("Chain the token lives on: base, ethereum, bsc, arbitrum, polygon or solana"),
  })
  .strip()
  .describe("Input schema for checking the risk of a token before buying it");

/**
 * Input schema for the scam message check
 */
export const CheckScamMessageSchema = z
  .object({
    text: z
      .string()
      .min(1)
      .max(8000)
      .describe("The message to check (DM, cast, tweet, email, comment)"),
    sender: z
      .string()
      .max(200)
      .optional()
      .describe("Optional sender name or handle as shown in the message"),
    channel: z
      .string()
      .max(60)
      .optional()
      .describe("Optional channel the message arrived on, e.g. X DM, Telegram, Discord, email"),
  })
  .strip()
  .describe("Input schema for checking whether a message is a scam or phishing attempt");

/**
 * Input schema for the prompt injection check
 */
export const CheckPromptInjectionSchema = z
  .object({
    text: z
      .string()
      .min(1)
      .max(20000)
      .describe("Untrusted text the agent is about to read (web page, email, tool result)"),
    context: z
      .string()
      .max(300)
      .optional()
      .describe("Optional description of what the agent is doing"),
  })
  .strip()
  .describe("Input schema for checking untrusted text for prompt injection");
