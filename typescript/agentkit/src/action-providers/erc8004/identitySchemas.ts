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
 * Input schema for updating agent metadata.
 * Loads current metadata, applies updates and stores the result on IPFS or onchain as a data URI.
 */
export const UpdateAgentMetadataSchema = z
  .object({
    agentId: z.string().describe("The agent ID to update"),

    // Presentation
    name: z.string().min(1).max(100).optional().describe("New name for the agent"),
    description: z.string().max(500).optional().describe("New description for the agent"),
    image: z.string().optional().describe("New image URL for the agent"),

    // Endpoints
    mcpEndpoint: z
      .string()
      .optional()
      .describe(
        "MCP server URL. Tools, prompts, and resources are auto-extracted from the endpoint.",
      ),
    a2aEndpoint: z
      .string()
      .optional()
      .describe("A2A agent card URL. Skills are auto-extracted from the endpoint."),
    ensName: z.string().optional().describe("ENS name for the agent (e.g., 'myagent.eth')"),

    // Status
    active: z.boolean().optional().describe("Set the agent active or inactive"),
    x402support: z.boolean().optional().describe("Enable or disable x402 payment support"),

    // Trust models (replaces all current trust settings when any flag is provided)
    trustReputation: z.boolean().optional().describe("Enable reputation trust model"),
    trustCryptoEconomic: z.boolean().optional().describe("Enable crypto-economic trust model"),
    trustTeeAttestation: z.boolean().optional().describe("Enable TEE attestation trust model"),

    // OASF taxonomies
    oasfSkills: z
      .array(z.string())
      .optional()
      .describe("OASF skill slugs to add (e.g., 'data_engineering/data_transformation_pipeline')"),
    oasfDomains: z
      .array(z.string())
      .optional()
      .describe("OASF domain slugs to add (e.g., 'finance_and_business/investment_services')"),

    // Custom metadata
    metadata: z
      .record(z.string(), z.string())
      .optional()
      .describe("Custom metadata key-value pairs to set on the agent"),
  })
  .strip()
  .describe("Updates agent configuration.");

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
 * Uses the agent0 SDK's indexed subgraph and optional semantic search.
 */
export const SearchAgentsSchema = z
  .object({
    keyword: z
      .string()
      .optional()
      .describe(
        "Natural-language semantic search query (e.g. 'financial data analysis agent'). Results are ranked by semantic relevance score.",
      ),
    name: z.string().optional().describe("Search by agent name (substring match)"),
    description: z.string().optional().describe("Search by agent description (substring match)"),
    require: z
      .array(z.enum(["mcp", "a2a", "active", "x402"]))
      .optional()
      .describe(
        "Status/capability requirements. ONLY add values the user explicitly asks for. " +
          "'mcp' = must have MCP endpoint, 'a2a' = must have A2A endpoint, " +
          "'active' = must be active, 'x402' = must support x402 payments. " +
          "Leave empty or omit if the user does not mention any of these.",
      ),
    minReputation: z.number().optional().describe("Minimum average reputation score"),
    maxReputation: z.number().optional().describe("Maximum average reputation score"),
    minCount: z.number().min(0).optional().describe("Minimum feedback count"),
    maxCount: z.number().min(0).optional().describe("Maximum feedback count"),
    fromReviewers: z
      .array(z.string())
      .optional()
      .describe("Only consider feedback from these reviewer wallet addresses"),
    reputationTag: z
      .string()
      .optional()
      .describe("Only consider feedback matching this tag when filtering by reputation"),
    sort: z
      .string()
      .optional()
      .describe(
        "Sort order, e.g. 'updatedAt:desc', 'averageValue:desc', 'name:asc'. " +
          "Defaults to 'semanticScore:desc' for keyword searches, 'updatedAt:desc' otherwise.",
      ),
    limit: z
      .number()
      .min(1)
      .max(50)
      .default(10)
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
