import { z } from "zod";

/**
 * Input schema for looking up a wallet's SAID reputation.
 */
export const GetAgentReputationSchema = z
  .object({
    wallet: z
      .string()
      .describe("The Solana wallet address (base58) of the agent or counterparty to look up"),
  })
  .strip()
  .describe("Look up the SAID reputation of a Solana wallet");

/**
 * Input schema for discovering SAID-registered agents.
 */
export const FindAgentsSchema = z
  .object({
    query: z.string().optional().describe("Free-text search over agent names and descriptions"),
    skill: z.string().optional().describe("Filter agents by a declared skill"),
    verifiedOnly: z
      .boolean()
      .optional()
      .default(true)
      .describe("Only return on-chain verified agents (default true)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(25)
      .optional()
      .default(5)
      .describe("Maximum number of agents to return (default 5)"),
  })
  .strip()
  .describe("Discover SAID-registered agents ranked by reputation");

/**
 * Input schema for registering the agent's own SAID identity.
 */
export const RegisterSaidIdentitySchema = z
  .object({
    metadataUri: z
      .string()
      .min(10)
      .max(200)
      .refine(
        uri => uri.startsWith("https://") || uri.startsWith("ipfs://") || uri.startsWith("ar://"),
        "metadataUri must start with https://, ipfs:// or ar://",
      )
      .describe(
        "URI of the agent's metadata card (JSON with name, description, skills, endpoints). " +
          "An A2A agent card URL (e.g. https://<host>/.well-known/agent-card.json) works well.",
      ),
  })
  .strip()
  .describe("Register and verify this wallet's SAID identity on Solana");

/**
 * Input schema for sending an A2A message to another agent via the SAID relay.
 */
export const SendAgentMessageSchema = z
  .object({
    toWallet: z
      .string()
      .describe("The Solana wallet address of the SAID-registered agent to message"),
    message: z.string().min(1).describe("The message text to send"),
    context: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Optional structured context object to attach to the message (e.g. a task spec)"),
  })
  .strip()
  .describe("Send an agent-to-agent message to another SAID agent via the SAID relay");

/**
 * Input schema for reading this agent's A2A inbox.
 */
export const CheckAgentMessagesSchema = z
  .object({
    status: z
      .string()
      .optional()
      .describe("Optional filter by task status (e.g. created, in_progress, completed)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(20)
      .describe("Maximum number of messages to return (default 20)"),
  })
  .strip()
  .describe("Read incoming A2A messages addressed to this wallet, with sender reputation");
