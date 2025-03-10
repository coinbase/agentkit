import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getMcpTools } from "@coinbase/agentkit-model-context-protocol";
import {
  AgentKit,
  CdpWalletProvider,
  wethActionProvider,
  walletActionProvider,
  erc20ActionProvider,
  erc721ActionProvider,
  cdpApiActionProvider,
  cdpWalletActionProvider,
  pythActionProvider,
} from "@coinbase/agentkit";
import * as fs from "fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Configure a file to persist the agent's CDP MPC Wallet Data
// const WALLET_DATA_FILE = "wallet_data.txt";

/**
 * Validates that required environment variables are set
 */
function validateEnvironment(): void {
  const requiredVars = ["CDP_API_KEY_NAME", "CDP_API_KEY_PRIVATE_KEY"];
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
 * Initialize the MCP server with CDP Agentkit
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
      }
    );

    let walletDataStr: string | null = null;

    // Read existing wallet data if available
    // if (fs.existsSync(WALLET_DATA_FILE)) {
    //   try {
    //     walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
    //   } catch (error) {
    //     console.error("Error reading wallet data:", error);
    //   }
    // }

    // Configure CDP Wallet Provider
    const config = {
      apiKeyName: process.env.CDP_API_KEY_NAME!,
      apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY!,
      cdpWalletData: walletDataStr || undefined,
      networkId: process.env.NETWORK_ID || "base-sepolia",
    };

    const walletProvider = await CdpWalletProvider.configureWithWallet(config);

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
          apiKeyName: config.apiKeyName,
          apiKeyPrivateKey: config.apiKeyPrivateKey,
        }),
        cdpWalletActionProvider({
          apiKeyName: config.apiKeyName,
          apiKeyPrivateKey: config.apiKeyPrivateKey,
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

    // Save wallet data
    // const exportedWallet = await walletProvider.exportWallet();
    // fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(exportedWallet));

    return server;
  } catch (error) {
    console.error("Failed to initialize server:", error);
    throw error;
  }
}

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