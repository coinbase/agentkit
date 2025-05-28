import {
  AgentKit,
  cdpApiActionProvider,
  erc20ActionProvider,
  erc721ActionProvider,
  pythActionProvider,
  SmartWalletProvider,
  walletActionProvider,
  wethActionProvider,
} from "@coinbase/agentkit";
import { getMcpTools } from "@coinbase/agentkit-model-context-protocol";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Address, Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
/**
 * Validates that required environment variables are set
 */
function validateEnvironment(): void {
  const requiredVars = ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET"];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set:");
    missingVars.forEach(varName => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }

  if (!process.env.NETWORK_ID) {
    console.warn("Warning: NETWORK_ID not set, defaulting to base-sepolia testnet");
  }
}

/**
 * This function creates a new server instance with the capabilities to handle MCP requests.
 * It configures the CDP Wallet Provider with the provided API keys and network ID.
 * It then initializes the AgentKit with the configured wallet provider and action providers.
 *
 * @returns {Promise<Server>} The initialized MCP server
 */
async function initializeServer() {
  try {
    // Create server instance with capabilities
    const server = new Server(
      {
        name: "cdp-agentkit",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // Configure CDP Wallet Provider
    const privateKey = (process.env.PRIVATE_KEY || generatePrivateKey()) as Hex;
    const signer = privateKeyToAccount(privateKey);

    const config = {
      apiKeyId: process.env.CDP_API_KEY_ID!,
      apiKeySecret: process.env.CDP_API_KEY_SECRET!,
      networkId: process.env.NETWORK_ID || "base-sepolia",
      smartWalletAddress: process.env.SMART_WALLET_ADDRESS as Address,
      signer,
    };

    const walletProvider = await SmartWalletProvider.configureWithWallet(config);

    if (!process.env.PRIVATE_KEY || !process.env.SMART_WALLET_ADDRESS) {
      console.log("Save your private key and smart wallet address to the environment variables");
      console.log("PRIVATE_KEY=" + privateKey);
      console.log("SMART_WALLET_ADDRESS=" + walletProvider.getAddress());
    }

    // Initialize AgentKit
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        wethActionProvider(),
        pythActionProvider(),
        walletActionProvider(),
        erc20ActionProvider(),
        erc721ActionProvider(),
        cdpApiActionProvider({
          apiKeyId: config.apiKeyId,
          apiKeySecret: config.apiKeySecret,
        }),
      ],
    });

    // Get MCP tools from AgentKit
    const { tools, toolHandler } = await getMcpTools(agentkit);

    // Set up request handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools,
      };
    });

    server.setRequestHandler(CallToolRequestSchema, async request => {
      try {
        return await toolHandler(request.params.name, request.params.arguments);
      } catch (error) {
        console.error(`Error executing tool ${request.params.name}:`, error);
        throw new Error(`Tool ${request.params.name} failed: ${error}`);
      }
    });

    return server;
  } catch (error) {
    console.error("Failed to initialize server:", error);
    throw error;
  }
}

/**
 * Main function to run the MCP server
 */
async function main() {
  validateEnvironment();

  try {
    const server = await initializeServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("CDP AgentKit MCP Server running on stdio");
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error("Fatal error in main():", error);
    process.exit(1);
  });
}
