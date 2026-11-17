import { z } from "zod";

/**
 * Supported chains for token / counterparty checks.
 */
export const ChainSchema = z
  .enum(["base", "ethereum", "arbitrum", "optimism", "polygon"])
  .describe(
    "The chain the token or address is on. Buy/sell simulation is available on base and ethereum.",
  );

/**
 * Input schema for check_token_risk.
 */
export const CheckTokenRiskSchema = z
  .object({
    tokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address format")
      .describe(
        "The ERC-20 token contract address to check, e.g. 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      ),
    chain: ChainSchema.default("base"),
  })
  .strip()
  .describe("Instructions for checking a token's risk before trading it");

/**
 * Input schema for check_payment_counterparty.
 */
export const CheckCounterpartySchema = z
  .object({
    address: z
      .string()
      .min(20)
      .max(120)
      .regex(/^[A-Za-z0-9]+$/, "Invalid address")
      .describe("The wallet address that is about to receive funds (EVM 0x..., or BTC/TRX/other)"),
    chain: ChainSchema.default("base"),
    counterpartyName: z
      .string()
      .max(200)
      .optional()
      .describe("Optional person or company name of the recipient, to sanctions-screen as well"),
  })
  .strip()
  .describe("Instructions for checking a recipient before sending a payment");

/**
 * Input schema for screen_sanctions.
 */
export const ScreenSanctionsSchema = z
  .object({
    name: z.string().min(1).max(200).describe("Person, company, vessel or aircraft name to screen"),
    entityType: z
      .enum(["individual", "entity", "vessel", "aircraft"])
      .optional()
      .describe("Optional filter on the type of listed party"),
  })
  .strip()
  .describe("Instructions for screening a name against sanctions lists");

/**
 * Configuration for the Agent Data APIs action provider.
 */
export interface AgentDataApisConfig {
  /**
   * Maximum USDC the agent may pay for a single check. Defaults to 0.05
   * (or AGENT_DATA_APIS_MAX_PAYMENT_USDC env var).
   */
  maxPaymentUsdc?: number;
  /** Override the Payment Guard base URL (token + counterparty checks). */
  guardBaseUrl?: string;
  /** Override the sanctions screening base URL. */
  sanctionsBaseUrl?: string;
}
