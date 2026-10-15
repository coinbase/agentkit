import { z } from "zod";

/**
 * Schema for registering an agent identity on PayLobster.
 */
export const RegisterIdentitySchema = z.object({
  name: z.string().describe('Agent name (e.g., "AI Assistant", "Trading Bot")'),
  agentURI: z.string().describe("URI pointing to agent metadata (IPFS hash or URL)"),
  capabilities: z
    .string()
    .describe('Comma-separated capabilities (e.g., "trading,analysis,escrow")'),
});

/**
 * Schema for creating a USDC escrow payment.
 */
export const CreateEscrowSchema = z.object({
  recipient: z.string().describe("Recipient address (0x...)"),
  amount: z.string().describe('Amount of USDC (e.g., "100" for $100 USDC)'),
  description: z.string().describe("Purpose of the escrow (e.g., 'Payment for AI analysis')"),
});

/**
 * Schema for releasing an escrow payment.
 */
export const ReleaseEscrowSchema = z.object({
  escrowId: z.string().describe("The escrow ID to release"),
});

/**
 * Schema for checking an agent's reputation.
 */
export const CheckReputationSchema = z.object({
  address: z.string().describe("Address to check reputation for (0x...)"),
});

/**
 * Schema for getting credit score information.
 */
export const GetCreditScoreSchema = z.object({
  address: z.string().describe("Address to check credit score for (0x...)"),
});

/**
 * Schema for getting agent profile information.
 */
export const GetAgentProfileSchema = z.object({
  address: z.string().describe("Agent address to look up (0x...)"),
});
