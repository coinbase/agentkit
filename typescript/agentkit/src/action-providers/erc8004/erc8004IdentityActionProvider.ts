import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  RegisterAgentSchema,
  UpdateAgentMetadataSchema,
  GetOwnedAgentsSchema,
  SearchAgentsSchema,
  GetAgentInfoSchema,
} from "./identitySchemas";
import { getChainIdFromNetwork, isNetworkSupported } from "./constants";
import { getAgent0SDK } from "./utils";

/**
 * Configuration options for the ERC8004 Identity Action Provider
 */
export interface ERC8004IdentityActionProviderConfig {
  pinataJwt?: string;
}

/**
 * ERC8004IdentityActionProvider provides actions for the ERC-8004 Identity Registry.
 * This includes agent registration, URI management, and on-chain metadata.
 */
export class ERC8004IdentityActionProvider extends ActionProvider<EvmWalletProvider> {
  private pinataJwt?: string;

  /**
   * Constructor for the ERC8004IdentityActionProvider.
   *
   * @param config - Optional configuration including Pinata JWT for IPFS uploads
   */
  constructor(config?: ERC8004IdentityActionProviderConfig) {
    super("erc8004_identity", []);
    this.pinataJwt = config?.pinataJwt;
  }

  /**
   * Updates agent registration metadata by loading the current state, modifying and re-registering.
   *
   * @param walletProvider - The wallet provider to use for the transaction
   * @param args - The agentId and optional fields to update
   * @returns A message confirming the update
   */
  @CreateAction({
    name: "update_agent_metadata",
    description: `
Updates agent configuration. All fields are optional — only provide what you want to change.

- Core: name, description, image
- Endpoints: mcpEndpoint (auto-extracts tools/prompts/resources), a2aEndpoint (auto-extracts skills), ensName
- Status: active, x402support
- Trust: trustReputation, trustCryptoEconomic, trustTeeAttestation (replaces all trust settings when any is provided)
- Taxonomies: oasfSkills, oasfDomains (OASF slugs to add)
- Custom: metadata (key-value pairs)

Examples:
- "Set MCP endpoint to https://mcp.example.com/"
- "Make the agent active and enable x402 support"
- "Add OASF skill data_engineering/data_transformation_pipeline"
`,
    schema: UpdateAgentMetadataSchema,
  })
  async updateAgentMetadata(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof UpdateAgentMetadataSchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const chainId = getChainIdFromNetwork(network);
      const fullAgentId = args.agentId.includes(":") ? args.agentId : `${chainId}:${args.agentId}`;
      const sdk = getAgent0SDK(walletProvider, this.pinataJwt);

      const agent = await sdk.loadAgent(fullAgentId);
      const updates: string[] = [];

      // Core
      const hasCoreUpdate = [args.name, args.description, args.image].some(v => v !== undefined);
      if (hasCoreUpdate) {
        agent.updateInfo(args.name, args.description, args.image);
        if (args.name !== undefined) updates.push(`Name: ${args.name}`);
        if (args.description !== undefined) updates.push(`Description: ${args.description}`);
        if (args.image !== undefined) updates.push(`Image: ${args.image}`);
      }

      // Endpoints
      if (args.mcpEndpoint !== undefined) {
        await agent.setMCP(args.mcpEndpoint);
        const tools = agent.mcpTools ?? [];
        updates.push(
          `MCP endpoint: ${args.mcpEndpoint}` +
            (tools.length ? ` (extracted ${tools.length} tools)` : ""),
        );
      }
      if (args.a2aEndpoint !== undefined) {
        await agent.setA2A(args.a2aEndpoint);
        const skills = agent.a2aSkills ?? [];
        updates.push(
          `A2A endpoint: ${args.a2aEndpoint}` +
            (skills.length ? ` (extracted ${skills.length} skills)` : ""),
        );
      }
      if (args.ensName !== undefined) {
        agent.setENS(args.ensName);
        updates.push(`ENS: ${args.ensName}`);
      }

      // Status
      if (args.active !== undefined) {
        agent.setActive(args.active);
        updates.push(`Active: ${args.active}`);
      }
      if (args.x402support !== undefined) {
        agent.setX402Support(args.x402support);
        updates.push(`x402 support: ${args.x402support}`);
      }

      // Trust models
      const hasTrustFlag =
        args.trustReputation !== undefined ||
        args.trustCryptoEconomic !== undefined ||
        args.trustTeeAttestation !== undefined;
      if (hasTrustFlag) {
        agent.setTrust(
          args.trustReputation ?? false,
          args.trustCryptoEconomic ?? false,
          args.trustTeeAttestation ?? false,
        );
        const models: string[] = [];
        if (args.trustReputation) models.push("reputation");
        if (args.trustCryptoEconomic) models.push("crypto-economic");
        if (args.trustTeeAttestation) models.push("tee-attestation");
        updates.push(`Trust models: ${models.length > 0 ? models.join(", ") : "(none)"}`);
      }

      // OASF taxonomies
      if (args.oasfSkills?.length) {
        for (const skill of args.oasfSkills) {
          agent.addSkill(skill, true);
        }
        updates.push(`OASF skills added: ${args.oasfSkills.join(", ")}`);
      }
      if (args.oasfDomains?.length) {
        for (const domain of args.oasfDomains) {
          agent.addDomain(domain, true);
        }
        updates.push(`OASF domains added: ${args.oasfDomains.join(", ")}`);
      }

      // Custom metadata
      if (args.metadata && Object.keys(args.metadata).length > 0) {
        agent.setMetadata(args.metadata);
        const entries = Object.entries(args.metadata)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ");
        updates.push(`Metadata: ${entries}`);
      }

      const handle = await agent.registerOnChain();
      await handle.waitMined();

      return `Agent updated successfully!\n\nAgent ID: ${args.agentId}\nUpdated fields:\n${updates.length > 0 ? updates.map(u => `- ${u}`).join("\n") : "(no changes)"}\n\nTransaction hash: ${handle.hash}`;
    } catch (error) {
      return `Error updating agent metadata: ${error}`;
    }
  }

  /**
   * Registers a new agent (register + set URI).
   * All fields are optional - defaults to "Agent <agentId>" for name, empty for others.
   *
   * @param walletProvider - The wallet provider to use
   * @param args - Optional agent name, description, and image
   * @returns A message with the registration details
   */
  @CreateAction({
    name: "register_agent",
    description: `
Registers a new agent on the ERC-8004 Identity Registry:
1. Mints an agent NFT
2. Generates registration JSON and sets the agent URI

All fields are optional! Proceed if not provided, metadata can be updated later with 'update_agent_metadata' action. 
Never choose values for optional fields unless explicitly asked to do so.
`,
    schema: RegisterAgentSchema,
  })
  async registerAgent(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RegisterAgentSchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const sdk = getAgent0SDK(walletProvider, this.pinataJwt);

      const agentName = args.name || "Agent";
      const agent = sdk.createAgent(agentName, args.description || "", args.image);

      const handle = await agent.registerOnChain();
      const { result } = await handle.waitMined();

      return `Agent registered successfully!\n\nAgent ID: ${result.agentId}\nName: ${result.name || agentName}\nDescription: ${args.description || "(empty)"}\nImage: ${args.image || "(empty)"}\nNetwork: ${network.networkId}\n\nMetadata URI: ${result.agentURI ?? "(onchain)"}\nTransaction hash: ${handle.hash}`;
    } catch (error) {
      return `Error during registration: ${error}`;
    }
  }

  /**
   * Gets all agents owned by a specified wallet address or the connected wallet.
   *
   * @param walletProvider - The wallet provider to use for reading
   * @param args - Optional wallet address to query and pagination parameters
   * @returns A message with the list of owned agents
   */
  @CreateAction({
    name: "get_owned_agents",
    description: `
Gets all agent IDs owned by an address. If no address is provided, uses the connected wallet address.
Returns a list of agents with their IDs, names and descriptions.
Supports pagination.
`,
    schema: GetOwnedAgentsSchema,
  })
  async getOwnedAgents(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetOwnedAgentsSchema>,
  ): Promise<string> {
    try {
      const network = walletProvider.getNetwork();
      const chainId = getChainIdFromNetwork(network);

      // Use provided wallet address or fall back to connected wallet
      const walletAddress = args.walletAddress || walletProvider.getAddress();

      // Initialize agent0 SDK
      const sdk = getAgent0SDK(walletProvider);

      // Search for agents owned by the specified wallet
      const result = await sdk.searchAgents({ owners: [walletAddress] });

      if (result.length === 0) {
        return `No agents found owned by ${walletAddress} on chain ${chainId}.`;
      }

      // Format the response
      const agentList = result
        .map(agent => {
          const name = agent.name || "Unnamed";
          const description = agent.description ? ` - ${agent.description.slice(0, 50)}...` : "";
          return `- Agent ID: ${agent.agentId}\n  Name: ${name}${description}`;
        })
        .join("\n\n");

      return `Found ${result.length} agent(s) owned by ${walletAddress}:\n\n${agentList}`;
    } catch (error) {
      return `Error retrieving owned agents: ${error}`;
    }
  }

  /**
   * Searches for agents by capabilities, attributes, or reputation.
   * Supports semantic (keyword) search, structured filters, sorting, and pagination.
   *
   * @param walletProvider - The wallet provider to use for reading
   * @param args - Search filters including keyword, name, tools, skills, reputation
   * @returns A message with the list of matching agents
   */
  @CreateAction({
    name: "search_agents",
    description: `
Search for registered agents using semantic search, structured filters, or both.
All filters are optional. Only include filters that the user explicitly requests.

Discovery:
- keyword: Natural-language semantic search (e.g. "financial data analysis agent")
- name / description: Substring match

Capabilities:
- mcpTools, a2aSkills, oasfSkills, oasfDomains: Filter by specific capabilities
- require: List of status/capability requirements (e.g. ["mcp", "active"]). Only add values the user explicitly asks for.

Status & reputation:
- minReputation / maxReputation: Filter by average reputation score
- reputationTag: Only consider feedback with this tag

Scope:
- networkId: Search a specific network (default: current network)

Sorting & pagination:
- sort: e.g. "averageValue:desc", "updatedAt:desc", "name:asc"
- limit: Max results to return (default: 10, max: 50)
- offset: Number of results to skip (default: 0)

`,
    schema: SearchAgentsSchema,
  })
  async searchAgents(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SearchAgentsSchema>,
  ): Promise<string> {
    try {
      console.log("args", args);
      const sdk = getAgent0SDK(walletProvider);
      const network = walletProvider.getNetwork();
      const currentChainId = getChainIdFromNetwork(network);

      const requirements = new Set(args.require ?? []);

      const hasReputationFilter =
        args.minReputation !== undefined ||
        args.maxReputation !== undefined ||
        (args.reputationTag !== undefined && args.reputationTag !== "") ||
        args.minCount !== undefined ||
        args.maxCount !== undefined ||
        (args.fromReviewers !== undefined && args.fromReviewers.length > 0);

      const searchFilters: Record<string, unknown> = {
        chains: [currentChainId],
        ...(args.keyword && { keyword: args.keyword }),
        ...(args.name && { name: args.name }),
        ...(args.description && { description: args.description }),
        ...(requirements.has("mcp") && { hasMCP: true }),
        ...(requirements.has("a2a") && { hasA2A: true }),
        ...(requirements.has("active") && { active: true }),
        ...(requirements.has("x402") && { x402support: true }),
        ...(hasReputationFilter && {
          feedback: {
            ...(args.minReputation !== undefined &&
              args.minReputation > 0 && { minValue: args.minReputation }),
            ...(args.maxReputation !== undefined &&
              args.maxReputation < 100 && { maxValue: args.maxReputation }),
            ...(args.minCount !== undefined && { minCount: args.minCount }),
            ...(args.maxCount !== undefined && { maxCount: args.maxCount }),
            ...(args.fromReviewers &&
              args.fromReviewers.length > 0 && {
                ...(args.fromReviewers && { fromReviewers: args.fromReviewers }),
              }),
            ...(args.reputationTag && { tag: args.reputationTag }),
          },
        }),
      };

      const searchOptions: Record<string, unknown> = {};
      if (args.sort) {
        searchOptions.sort = [args.sort];
      }
      console.log("searchOptions", searchOptions);
      console.log("searchFilters", searchFilters);

      const allAgents = await sdk.searchAgents(searchFilters, searchOptions);
      console.log("found agents number: ", allAgents.length);

      if (allAgents.length === 0) {
        return "No agents found matching the specified criteria.";
      }

      const limit = args.limit ?? 10;
      const offset = args.offset ?? 0;
      const paginatedAgents = allAgents.slice(offset, offset + limit);
      const totalFound = allAgents.length;
      const hasMore = offset + limit < totalFound;

      const agentList = paginatedAgents
        .map(agent => {
          const lines: string[] = [];
          lines.push(`- Agent ID: ${agent.agentId}`);
          lines.push(`  Name: ${agent.name || "Unnamed"}`);

          if (agent.description) {
            const desc =
              agent.description.length > 120
                ? `${agent.description.slice(0, 120)}...`
                : agent.description;
            lines.push(`  Description: ${desc}`);
          }
          if (agent.averageValue !== undefined) lines.push(`  Reputation: ${agent.averageValue}`);
          if (agent.feedbackCount) lines.push(`  Feedback count: ${agent.feedbackCount}`);
          if (agent.semanticScore !== undefined)
            lines.push(`  Relevance: ${agent.semanticScore.toFixed(3)}`);

          const mcpOn = Boolean(agent.mcp);
          const a2aOn = Boolean(agent.a2a);
          const x402On = agent.x402support === true;
          lines.push(
            `  MCP: ${mcpOn ? "Yes" : "No"} | A2A: ${a2aOn ? "Yes" : "No"} | x402: ${x402On ? "Yes" : "No"}`,
          );

          return lines.join("\n");
        })
        .join("\n\n");

      let response = `Found ${totalFound} agent(s) on ${network.networkId}, showing ${offset + 1}-${offset + paginatedAgents.length}:\n\n${agentList}`;

      if (hasMore) {
        response += `\n\n(More results available. Use offset: ${offset + limit} to fetch next page)`;
      }

      return response;
    } catch (error) {
      return `Error searching agents: ${error}`;
    }
  }

  /**
   * Gets comprehensive information about an agent including identity, endpoints, capabilities, and reputation.
   *
   * @param walletProvider - The wallet provider to use for reading
   * @param args - The agentId to look up
   * @returns A message with comprehensive agent information
   */
  @CreateAction({
    name: "get_agent_info",
    description: `
Gets comprehensive information about an agent including identity, endpoints, capabilities, and reputation.
Uses indexed data for fast retrieval.

The agentId can be in either format:
- "123" - Uses the current network's chain ID
- "84532:123" - Explicitly specifies the chain ID

Returns:
- Basic info: name, description, image
- Owner address
- Endpoints: MCP, A2A, ENS
- Capabilities: mcpTools, a2aSkills, oasfSkills/domains
- Reputation summary: averageValue, feedbackCount
- Status: active, x402support
`,
    schema: GetAgentInfoSchema,
  })
  async getAgentInfo(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetAgentInfoSchema>,
  ): Promise<string> {
    try {
      const sdk = getAgent0SDK(walletProvider);
      const network = walletProvider.getNetwork();
      const chainId = getChainIdFromNetwork(network);

      // Handle both "agentId" and "chainId:agentId" formats
      const fullAgentId = args.agentId.includes(":") ? args.agentId : `${chainId}:${args.agentId}`;

      const agent = await sdk.getAgent(fullAgentId);

      if (!agent) {
        return `Agent ${args.agentId} not found.`;
      }

      // Build comprehensive response
      const sections: string[] = [];

      // Basic info
      sections.push(`## Agent ${agent.agentId}`);
      sections.push(`Name: ${agent.name || "Not set"}`);
      if (agent.description) {
        sections.push(`Description: ${agent.description}`);
      }
      if (agent.image) {
        sections.push(`Image: ${agent.image}`);
      }

      // Ownership
      if (agent.owners?.length) {
        sections.push(`\n## Ownership`);
        sections.push(`Owner(s): ${agent.owners.join(", ")}`);
      }
      if (agent.walletAddress) {
        sections.push(`Wallet Address: ${agent.walletAddress}`);
      }

      // Endpoints
      const endpoints: string[] = [];
      if (agent.mcp) {
        const mcpUrl = typeof agent.mcp === "string" ? agent.mcp : "Enabled";
        endpoints.push(`MCP: ${mcpUrl}`);
      }
      if (agent.a2a) {
        const a2aUrl = typeof agent.a2a === "string" ? agent.a2a : "Enabled";
        endpoints.push(`A2A: ${a2aUrl}`);
      }
      if (agent.ens) endpoints.push(`ENS: ${agent.ens}`);
      if (agent.did) endpoints.push(`DID: ${agent.did}`);
      if (endpoints.length > 0) {
        sections.push(`\n## Endpoints`);
        sections.push(endpoints.join("\n"));
      }

      // Capabilities
      const capabilities: string[] = [];
      if (agent.mcpTools?.length) {
        capabilities.push(`MCP Tools: ${agent.mcpTools.join(", ")}`);
      }
      if (agent.mcpPrompts?.length) {
        capabilities.push(`MCP Prompts: ${agent.mcpPrompts.join(", ")}`);
      }
      if (agent.mcpResources?.length) {
        capabilities.push(`MCP Resources: ${agent.mcpResources.join(", ")}`);
      }
      if (agent.a2aSkills?.length) {
        capabilities.push(`A2A Skills: ${agent.a2aSkills.join(", ")}`);
      }
      if (capabilities.length > 0) {
        sections.push(`\n## Capabilities`);
        sections.push(capabilities.join("\n"));
      }

      // Status
      sections.push(`\n## Status`);
      sections.push(`Active: ${agent.active ?? "Unknown"}`);
      if (agent.x402support !== undefined) {
        sections.push(`x402 Support: ${agent.x402support}`);
      }

      // Reputation
      try {
        const reputationSummary = await sdk.getReputationSummary(fullAgentId);
        if (reputationSummary && reputationSummary.count > 0) {
          sections.push(`\n## Reputation`);
          sections.push(`Average Score: ${reputationSummary.averageValue}`);
          sections.push(`Total Feedback: ${reputationSummary.count}`);
        } else {
          sections.push(`\n## Reputation`);
          sections.push(`No feedback received yet`);
        }
      } catch {
        // Reputation data not available - skip section
      }

      return sections.join("\n");
    } catch (error) {
      return `Error getting agent info: ${error}`;
    }
  }

  /**
   * Checks if the action provider supports the given network.
   *
   * @param network - The network to check
   * @returns True if the network is supported for ERC-8004
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && isNetworkSupported(network);
}

/**
 * Factory function to create an ERC8004IdentityActionProvider
 *
 * @param config - Optional configuration including Pinata JWT
 * @returns A new ERC8004IdentityActionProvider instance
 */
export const erc8004IdentityActionProvider = (config?: ERC8004IdentityActionProviderConfig) =>
  new ERC8004IdentityActionProvider(config);
