import { z } from "zod";

/**
 * Input schema for registering an AI agent on Helixa AgentDNA.
 */
export const RegisterAgentSchema = z
  .object({
    name: z.string().describe("The agent's name (e.g. 'MyTradingBot')"),
    framework: z
      .string()
      .describe(
        "The framework the agent runs on (e.g. 'AgentKit', 'LangChain', 'ElizaOS', 'OpenClaw', 'CrewAI')",
      ),
    soulbound: z
      .boolean()
      .default(true)
      .describe(
        "Whether the identity NFT is soulbound (non-transferable). Default true for production agents.",
      ),
    agentName: z
      .string()
      .optional()
      .describe(
        "Optional .agent name to register (e.g. 'mybot' becomes mybot.agent). Lowercase a-z, 0-9, hyphens, 3-32 chars.",
      ),
    tokenURI: z.string().optional().describe("Optional metadata URI for the agent's identity"),
  })
  .strip()
  .describe("Instructions for registering an AI agent on Helixa AgentDNA");

/**
 * Input schema for looking up an agent by token ID.
 */
export const GetAgentSchema = z
  .object({
    tokenId: z.string().describe("The token ID of the agent to look up"),
  })
  .strip()
  .describe("Instructions for looking up an agent by token ID");

/**
 * Input schema for looking up an agent by wallet address.
 */
export const GetAgentByAddressSchema = z
  .object({
    agentAddress: z.string().describe("The wallet address to look up agent identity for"),
  })
  .strip()
  .describe("Instructions for looking up an agent by wallet address");

/**
 * Input schema for mutating (version updating) an agent.
 */
export const MutateAgentSchema = z
  .object({
    tokenId: z.string().describe("The token ID of the agent to mutate"),
    newVersion: z.string().describe("The new version string (e.g. '2.0.0')"),
    reason: z.string().describe("The reason for the mutation"),
  })
  .strip()
  .describe("Instructions for recording a version change on an agent");

/**
 * Input schema for adding a trait to an agent.
 */
export const AddTraitSchema = z
  .object({
    tokenId: z.string().describe("The token ID of the agent to add a trait to"),
    traitType: z
      .string()
      .describe("The trait category (e.g. 'personality', 'skill', 'alignment')"),
    traitValue: z
      .string()
      .describe("The trait value (e.g. 'analytical', 'defi-trading', 'chaotic-good')"),
  })
  .strip()
  .describe("Instructions for adding a trait to an agent");

/**
 * Input schema for resolving a .agent name.
 */
export const ResolveNameSchema = z
  .object({
    name: z.string().describe("The .agent name to resolve (without the .agent suffix)"),
  })
  .strip()
  .describe("Instructions for resolving a .agent name to a wallet address");

/**
 * Input schema for checking .agent name availability.
 */
export const CheckNameSchema = z
  .object({
    name: z.string().describe("The .agent name to check availability for (without the .agent suffix)"),
  })
  .strip()
  .describe("Instructions for checking .agent name availability");

/**
 * Input schema for getting Helixa protocol statistics.
 */
export const GetStatsSchema = z
  .object({})
  .strip()
  .describe("Instructions for getting Helixa protocol statistics");
