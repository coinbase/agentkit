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
import {
  PinataConfig,
  getAgent0SDK,
  jsonToDataUri,
  ipfsToHttpUrl,
  loadOrHydrateAgent,
} from "./utils";

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
  private pinataConfig?: PinataConfig;

  /**
   * Constructor for the ERC8004IdentityActionProvider.
   *
   * @param config - Optional configuration including Pinata JWT for IPFS uploads
   */
  constructor(config?: ERC8004IdentityActionProviderConfig) {
    super("erc8004_identity", []);
    if (config?.pinataJwt) {
      this.pinataConfig = { jwt: config.pinataJwt };
    }
  }

  /**
   * Updates agent registration metadata by loading the current state, modifying and re-registering.
   *
   * @param walletProvider - The wallet provider to use for the transaction
   * @param args - The agentId and optional fields to update (name, description, image)
   * @returns A message confirming the metadata was updated
   */
  @CreateAction({
    name: "update_agent_metadata",
    description: `
Updates agent registration metadata (name, description, image).
Example: "update description to 'A trading assistant agent'"
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
      const fullAgentId = `${chainId}:${args.agentId}`;
      const sdk = getAgent0SDK(walletProvider, this.pinataConfig?.jwt);

      let newUri: string;
      let txHash: string;

      const agent = await loadOrHydrateAgent(sdk, walletProvider, fullAgentId, args.agentId);
      agent.updateInfo(args.name, args.description, args.image);

      if (this.pinataConfig) {
        const handle = await agent.registerIPFS();
        const { result } = await handle.waitMined();
        newUri = result.agentURI ?? "";
        txHash = handle.hash;
      } else {
        const regFile = agent.getRegistrationFile();
        const dataUri = jsonToDataUri(regFile);
        const handle = await agent.setAgentURI(dataUri);
        await handle.waitMined();
        newUri = dataUri;
        txHash = handle.hash;
      }

      const updates: string[] = [];
      if (args.name !== undefined) updates.push(`Name: ${args.name}`);
      if (args.description !== undefined) updates.push(`Description: ${args.description}`);
      if (args.image !== undefined) updates.push(`Image: ${args.image}`);

      const uriDisplay = newUri.startsWith("ipfs://")
        ? `Metadata URI: ${newUri}\nHTTP Gateway: ${ipfsToHttpUrl(newUri)}`
        : `Metadata URI: (onchain data URI)`;

      return `Agent metadata updated successfully!\n\nAgent ID: ${args.agentId}\nUpdated fields:\n${updates.length > 0 ? updates.map(u => `- ${u}`).join("\n") : "(no changes)"}\n\n${uriDisplay}\nTransaction hash: ${txHash}`;
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
      const sdk = getAgent0SDK(walletProvider, this.pinataConfig?.jwt);

      const agentName = args.name || "Agent";
      const agent = sdk.createAgent(agentName, args.description || "", args.image);

      if (this.pinataConfig) {
        const handle = await agent.registerIPFS();
        const { result } = await handle.waitMined();

        const agentId = result.agentId!;
        const agentURI = result.agentURI ?? "";
        const httpUrl = ipfsToHttpUrl(agentURI);

        return `Agent registered successfully!\n\nAgent ID: ${agentId}\nName: ${result.name || agentName}\nDescription: ${args.description || "(empty)"}\nImage: ${args.image || "(empty)"}\nNetwork: ${network.networkId}\n\nMetadata URI: ${agentURI}\nHTTP Gateway: ${httpUrl}\n\nTransaction hash: ${handle.hash}`;
      }

      // No IPFS: register with empty URI, then set a data URI containing the agentId
      const handle = await agent.registerHTTP("");
      const { result } = await handle.waitMined();

      const agentId = result.agentId!;
      const regFile = agent.getRegistrationFile();
      const dataUri = jsonToDataUri(regFile);
      const handle2 = await agent.setAgentURI(dataUri);
      await handle2.waitMined();

      return `Agent registered successfully!\n\nAgent ID: ${agentId}\nName: ${result.name || agentName}\nDescription: ${args.description || "(empty)"}\nImage: ${args.image || "(empty)"}\nNetwork: ${network.networkId}\n\nMetadata: stored on-chain (data URI)\n\nTransaction hashes:\n- Register: ${handle.hash}\n- Set URI: ${handle2.hash}`;
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
   *
   * @param walletProvider - The wallet provider to use for reading
   * @param args - Search filters including name, tools, skills, reputation
   * @returns A message with the list of matching agents
   */
  @CreateAction({
    name: "search_agents",
    description: `
Search for registered agents by capabilities, attributes, or reputation.
All filters are optional. Results are filtered by capabilities first, then by reputation.

Search filters:
- name: Substring match on agent name
- mcpTools: Filter by MCP tools the agent offers
- a2aSkills: Filter by A2A skills
- oasfSkills: Filter by OASF skill taxonomy
- oasfDomains: Filter by OASF domain taxonomy
- active: Only return active agents (default: true)
- x402support: Filter by x402 payment support
- minReputation / maxReputation: Filter by average reputation score

Pagination:
- limit: Maximum results to return (default: 10, max: 50)
- offset: Number of results to skip (default: 0)

This is a read-only operation using indexed data for fast queries.
`,
    schema: SearchAgentsSchema,
  })
  async searchAgents(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SearchAgentsSchema>,
  ): Promise<string> {
    try {
      const sdk = getAgent0SDK(walletProvider);

      console.log("args", args);
      const searchFilters = {
        name: args.name,
        mcpTools: args.mcpTools,
        a2aSkills: args.a2aSkills,
        active: args.active,
        x402support: args.x402support,
      };

      const allAgents = await sdk.searchAgents(searchFilters);

      if (allAgents.length === 0) {
        return "No agents found matching the specified criteria.";
      }

      // Apply action-level pagination
      const limit = args.limit ?? 10;
      const offset = args.offset ?? 0;
      const paginatedAgents = allAgents.slice(offset, offset + limit);
      const totalFound = allAgents.length;
      const hasMore = offset + limit < totalFound;

      // Format the response
      const agentList = paginatedAgents
        .map(agent => {
          const name = agent.name || "Unnamed";
          const description = agent.description
            ? `\n  Description: ${agent.description.slice(0, 100)}${agent.description.length > 100 ? "..." : ""}`
            : "";
          const tools = agent.mcpTools?.length ? `\n  MCP Tools: ${agent.mcpTools.join(", ")}` : "";
          const skills = agent.a2aSkills?.length
            ? `\n  A2A Skills: ${agent.a2aSkills.join(", ")}`
            : "";
          const status = agent.active !== undefined ? `\n  Active: ${agent.active}` : "";

          return `- Agent ID: ${agent.agentId}\n  Name: ${name}${description}${tools}${skills}${status}`;
        })
        .join("\n\n");

      let response = `Found ${totalFound} agent(s) total, showing ${offset + 1}-${offset + paginatedAgents.length}:\n\n${agentList}`;

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
      if (agent.mcp) endpoints.push(`MCP: Enabled`);
      if (agent.a2a) endpoints.push(`A2A: Enabled`);
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
