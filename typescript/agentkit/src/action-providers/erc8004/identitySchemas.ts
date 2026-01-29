import { z } from "zod";

/**
 * Input schema for registering an agent (mints agent NFT).
 * Use only when user provides no input - just registers and returns agentId.
 */
export const RegisterAgentSchema = z
  .object({})
  .strip()
  .describe(
    "Registers a new agent by minting an agent NFT. Returns the agentId. Use only when user provides no input at all.",
  );

/**
 * Input schema for setting agent registration (upload to IPFS + set URI on-chain).
 * Use when you have an agentId and want to set its metadata.
 */
export const SetAgentRegistrationSchema = z
  .object({
    agentId: z.string().describe("The agent ID to set registration for"),
    name: z.string().min(1).max(100).describe("The name of the agent"),
    description: z
      .string()
      .max(500)
      .optional()
      .describe("A description of the agent's capabilities"),
    image: z.string().optional().describe("Optional image URL (https:// or ipfs://) for the agent"),
  })
  .strip()
  .describe(
    "Uploads registration JSON to IPFS and sets the agent URI on-chain in one action. Use when you already have an agentId.",
  );

/**
 * Input schema for getting agent identity information.
 */
export const GetAgentIdentitySchema = z
  .object({
    agentId: z.string().describe("The agent ID to look up"),
  })
  .strip()
  .describe("Gets the owner and URI for an agent");

/**
 * Input schema for setting on-chain metadata.
 */
export const SetMetadataSchema = z
  .object({
    agentId: z.string().describe("The agent ID to set metadata for"),
    key: z.string().min(1).max(100).describe("The metadata key"),
    value: z.string().describe("The metadata value (will be encoded as bytes)"),
  })
  .strip()
  .describe("Sets an on-chain key-value metadata entry for an agent");

/**
 * Input schema for getting on-chain metadata.
 */
export const GetMetadataSchema = z
  .object({
    agentId: z.string().describe("The agent ID to get metadata for"),
    key: z.string().min(1).max(100).describe("The metadata key to retrieve"),
  })
  .strip()
  .describe("Gets an on-chain metadata value for an agent by key");

/**
 * Input schema for complete agent registration (register + upload + set URI).
 */
export const RegisterAgentCompleteSchema = z
  .object({
    name: z.string().min(1).max(100).describe("The name of the agent"),
    description: z
      .string()
      .max(500)
      .optional()
      .describe("A description of the agent's capabilities"),
    image: z.string().optional().describe("Optional image URL (https:// or ipfs://) for the agent"),
  })
  .strip()
  .describe(
    "Complete agent registration: registers agent, uploads registration JSON to IPFS, and sets the agent URI",
  );
