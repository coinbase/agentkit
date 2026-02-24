import { z } from "zod";

/**
 * Input schema for registering a new agent.
 * All fields are optional - if not provided, defaults will be used:
 * - name: "Agent <agentId>"
 * - description: "" (empty)
 * - image: "" (empty)
 */
export const RegisterAgentSchema = z
  .object({
    name: z.string().min(1).max(100).optional().describe("The name of the agent (optional)"),
    description: z
      .string()
      .max(500)
      .optional()
      .describe("A description of the agent's capabilities (optional)"),
    image: z
      .string()
      .optional()
      .describe("Optional image URL (https:// or ipfs://) for the agent (optional)"),
  })
  .strip()
  .describe("Registers a new agent.");

/**
 * Input schema for updating agent metadata (IPFS registration file).
 * Retrieves existing JSON from IPFS, updates specified fields, uploads new JSON, and sets URI on-chain.
 */
export const UpdateAgentMetadataSchema = z
  .object({
    agentId: z.string().describe("The agent ID to update metadata for"),
    name: z.string().min(1).max(100).optional().describe("New name for the agent (optional)"),
    description: z
      .string()
      .max(500)
      .optional()
      .describe("New description for the agent (optional)"),
    image: z.string().optional().describe("New image URL for the agent (optional)"),
  })
  .strip()
  .describe(
    "Updates agent registration metadata: retrieves existing JSON from IPFS, updates specified fields, uploads new JSON to IPFS, and sets the new URI on-chain",
  );

/**
 * Input schema for getting all agents owned by a wallet address.
 */
export const GetOwnedAgentsSchema = z
  .object({
    walletAddress: z
      .string()
      .optional()
      .describe("The wallet address to query (optional, defaults to the connected wallet address)"),
    pageSize: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe("Number of results per page (default: 50, max: 100)"),
    cursor: z.string().optional().describe("Pagination cursor from a previous result"),
  })
  .strip()
  .describe(
    "Gets all agent IDs owned by a wallet address using the agent0 SDK search functionality",
  );

/**
 * Input schema for searching agents by capabilities, attributes, or reputation.
 * Uses the agent0 SDK's indexed subgraph for fast queries.
 */
export const SearchAgentsSchema = z
  .object({
    name: z.string().optional().describe("Search by agent name (substring match)"),
    mcpTools: z.array(z.string()).optional().describe("Filter by MCP tools the agent offers"),
    a2aSkills: z.array(z.string()).optional().describe("Filter by A2A skills"),
    oasfSkills: z.array(z.string()).optional().describe("Filter by OASF skill taxonomy"),
    oasfDomains: z.array(z.string()).optional().describe("Filter by OASF domain taxonomy"),
    active: z
      .boolean()
      .optional()
      .describe("Filter by active status (true=active only, false=inactive only, omit=all)"),
    x402support: z.boolean().optional().describe("Filter by x402 payment support"),
    minReputation: z.number().optional().describe("Minimum average reputation score"),
    maxReputation: z.number().optional().describe("Maximum average reputation score"),
    limit: z
      .number()
      .min(1)
      .max(50)
      .optional()
      .describe("Maximum number of results to return (default: 10)"),
    offset: z.number().min(0).optional().describe("Number of results to skip (default: 0)"),
  })
  .strip()
  .describe("Searches for registered agents by capabilities, attributes, or reputation");

/**
 * Input schema for getting comprehensive agent information.
 * Uses the agent0 SDK's indexed data for fast retrieval.
 */
export const GetAgentInfoSchema = z
  .object({
    agentId: z.string().describe("The agent ID (format: agentId or chainId:agentId)"),
  })
  .strip()
  .describe(
    "Gets comprehensive information about an agent including identity, endpoints, capabilities, and reputation",
  );
