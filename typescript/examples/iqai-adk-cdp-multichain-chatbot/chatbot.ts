import {
  AgentKit,
  CdpEvmWalletProvider,
  walletActionProvider,
  erc20ActionProvider,
  cdpApiActionProvider,
  cdpEvmWalletActionProvider,
  x402ActionProvider,
  pythActionProvider,
} from "@coinbase/agentkit";
import { getAdkTools } from "@coinbase/agentkit-iqai-adk";
import { AgentBuilder, LlmAgent, createTool, type BaseTool, type EnhancedRunner } from "@iqai/adk";
import * as dotenv from "dotenv";
import * as readline from "readline";
import { z } from "zod";

dotenv.config();

// ============================================================================
// NETWORK CONFIGURATION
// ============================================================================

// Parse NETWORK_IDS from environment or use defaults
const getNetworkIds = (): string[] => {
  const envNetworks = process.env.NETWORK_IDS;
  if (envNetworks) {
    return envNetworks
      .split(",")
      .map(n => n.trim())
      .filter(n => n.length > 0);
  }
  return ["base-sepolia", "ethereum-sepolia"];
};

const SUPPORTED_NETWORKS = getNetworkIds();
const DEFAULT_NETWORK = SUPPORTED_NETWORKS[0];

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validates that required environment variables are set
 *
 * @throws {Error} - If required environment variables are missing
 * @returns {void}
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];
  const requiredVars = ["CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "CDP_WALLET_SECRET"];

  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach(varName => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }
}

validateEnvironment();

// ============================================================================
// CHAIN STATE MANAGEMENT
// ============================================================================

// Use a closure to maintain state across tool calls
let currentChain = DEFAULT_NETWORK;

/**
 * Gets the currently active blockchain network ID
 *
 * @returns {string} The current chain ID
 */
function getCurrentChainId(): string {
  return currentChain;
}

/**
 * Sets the currently active blockchain network ID
 *
 * @param chainId - The network ID to set as current
 * @returns {void}
 */
function setCurrentChainId(chainId: string): void {
  currentChain = chainId;
}

// ============================================================================
// CHAIN SWITCHING TOOLS
// ============================================================================

/**
 * Creates tools for switching between blockchain networks
 *
 * @returns {BaseTool[]} Array of chain switching tools
 */
function createChainSwitchingTools() {
  const tools: BaseTool[] = [];

  // Single switch tool with network parameter using Zod schema
  // Create dynamic enum from supported networks
  const networkIds = SUPPORTED_NETWORKS;
  const networkSchema = z.object({
    network: z
      .enum(networkIds as [string, ...string[]])
      .describe(`The network ID to switch to. Supported: ${networkIds.join(", ")}`),
  });

  const switchNetworkTool = createTool({
    name: "switch_network",
    description: `Switch to a different blockchain network. Supported networks: ${networkIds.join(", ")}`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: networkSchema as any,
    fn: async (args: { network: string }) => {
      try {
        // Validate and extract network parameter
        const network = args?.network;

        if (!network || typeof network !== "string") {
          const msg = `Missing or invalid 'network' parameter. Expected one of: ${networkIds.join(", ")}. Received: ${JSON.stringify(args)}`;
          return msg;
        }

        const targetNetwork = SUPPORTED_NETWORKS.find(n => n === network);
        if (!targetNetwork) {
          const msg = `Unknown network '${network}'. Supported networks are: ${SUPPORTED_NETWORKS.join(", ")}`;
          return msg;
        }

        setCurrentChainId(network);
        const successMsg = `Successfully switched to ${targetNetwork}`;
        return successMsg;
      } catch (error) {
        const errorMsg = `Exception in switch_network: ${error instanceof Error ? error.message : String(error)}`;
        return errorMsg;
      }
    },
  });

  tools.push(switchNetworkTool);

  // Add current chain query tool
  const getCurrentChain = createTool({
    name: "get_current_chain",
    description: "Get the currently active blockchain network",
    fn: async () => {
      const chainId = getCurrentChainId();
      const network = SUPPORTED_NETWORKS.find(n => n === chainId);
      return `${network || chainId} (${chainId})`;
    },
  });

  tools.push(getCurrentChain);

  // Add list networks tool
  const listNetworks = createTool({
    name: "list_supported_networks",
    description: "List all supported blockchain networks",
    fn: async () => {
      const networkList = SUPPORTED_NETWORKS.map(n => `  - ${n} (${n})`).join("\n");
      return `Supported networks:\n${networkList}`;
    },
  });

  tools.push(listNetworks);

  return tools;
}

// ============================================================================
// NETWORK AGENTS
// ============================================================================

/**
 * Creates a network-specific agent for blockchain operations
 *
 * @param networkId - The network ID to create an agent for
 * @returns {Promise<LlmAgent>} A configured agent for the specified network
 */
async function createNetworkAgent(networkId: string): Promise<LlmAgent> {
  const network = SUPPORTED_NETWORKS.find(n => n === networkId);
  if (!network) {
    throw new Error(`Unsupported network: ${networkId}`);
  }

  const cdpWalletConfig = {
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
    walletSecret: process.env.CDP_WALLET_SECRET,
    idempotencyKey: process.env.IDEMPOTENCY_KEY,
    address: process.env.ADDRESS as `0x${string}` | undefined,
    networkId,
    rpcUrl: process.env[`RPC_URL_${networkId.toUpperCase().replace(/-/g, "_")}`],
  };

  const walletProvider = await CdpEvmWalletProvider.configureWithWallet(cdpWalletConfig);

  const actionProviders = [
    walletActionProvider(),
    cdpApiActionProvider(),
    cdpEvmWalletActionProvider(),
    erc20ActionProvider(),
    x402ActionProvider(),
    pythActionProvider(),
  ];

  const agentkit = await AgentKit.from({
    walletProvider,
    actionProviders,
  });

  const tools = await getAdkTools(agentkit);

  // Customize faucet instruction based on network
  const faucetInstruction = networkId.includes("sepolia")
    ? `If you ever need funds, you can request them from the faucet.`
    : `If you need funds, provide your wallet details and request them from the user.`;

  return new LlmAgent({
    name: `${networkId.replace(/-/g, "_")}_agent`,
    model: process.env.LLM_MODEL || "gpt-4o",
    description: `Agent operating on ${network}`,
    instruction: `
      You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit on the ${network} network.
      You are empowered to interact onchain using your tools. ${faucetInstruction}.
      Be concise and helpful with your responses. Refrain from restating your tools' descriptions unless it is explicitly requested.
      Strictly follow the user's instructions, do not suggest unrelated follow-up actions.

      IMPORTANT:
      - You can only operate on ${network}.
      - If the user requests operations on a different network, inform them they need to switch networks first.
      - If the user asks which networks are supported, use the list_supported_networks tool via the multi_chain_coordinator agent.
    `,
    tools,
  });
}

// ============================================================================
// MULTI-CHAIN COORDINATOR
// ============================================================================

/**
 * Creates a multi-chain coordinator that manages network switching and delegates operations
 *
 * @returns {Promise<EnhancedRunner>} A configured multi-chain coordinator
 */
async function createMultiChainCoordinator(): Promise<EnhancedRunner> {
  console.log("Initializing network agents...");

  // Create all network agents as LlmAgents
  const networkAgents: LlmAgent[] = [];
  for (const network of SUPPORTED_NETWORKS) {
    const agent = await createNetworkAgent(network);
    networkAgents.push(agent);
  }

  const chainTools = createChainSwitchingTools();

  // Build network descriptions for instructions
  const networkDescriptions = SUPPORTED_NETWORKS.map(
    n => `  - ${n} (${n}): ${n.replace(/-/g, "_")}_agent`,
  ).join("\n");

  const { runner } = await AgentBuilder.create("multi_chain_coordinator")
    .withModel(process.env.LLM_MODEL || "gpt-4o")
    .withDescription("Multi-chain coordinator")
    .withInstruction(
      `
      You coordinate multi-chain blockchain operations and delegate to network-specific agents.
      
      NETWORK STATE:
      - Default: ${DEFAULT_NETWORK}
      - Check current: use get_current_chain tool
      - Switch: call switch_network with {"network": "network-id"}
      - List all: use list_supported_networks tool
      
      NETWORKS & AGENTS:
${networkDescriptions}
      
      WORKFLOW:
      1. Network switching: Call switch_network, confirm to user, don't delegate operations
      2. Blockchain operations: Check current network, delegate to corresponding agent
      
      RULES:
      - Each agent operates only on its designated network
      - Always pass {"network": "id"} parameter to switch_network (never empty object)
      - You handle routing; agents handle blockchain operations
    `,
    )
    .withTools(...chainTools)
    .withSubAgents(networkAgents)
    .build();

  return runner;
}

// ============================================================================
// CHAT INTERFACE
// ============================================================================

/**
 * Runs the chatbot in interactive chat mode
 *
 * @param coordinator - The multi-chain coordinator to interact with
 * @returns {Promise<void>}
 */
async function runChatMode(coordinator: EnhancedRunner): Promise<void> {
  console.log("🤖 Multi-Chain Chatbot Ready!");
  console.log("\n💡 Available commands:");
  const networkExamples = SUPPORTED_NETWORKS.slice(0, 2)
    .map(n => `"switch to ${n}"`)
    .join(" or ");
  console.log(`   - Switch networks: ${networkExamples}`);
  console.log(`   - Check current: "which network am I on?" or "get current chain"`);
  console.log(`   - List networks: "what networks are supported?"`);
  console.log(`   - Operations: "check my balance", "send 0.01 ETH to 0x...", "wallet info"`);
  console.log(`   - Exit: "exit"\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  try {
    console.log(
      `📍 Starting on ${SUPPORTED_NETWORKS.find(n => n === DEFAULT_NETWORK) || DEFAULT_NETWORK}\n`,
    );

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const userInput = await question("💬 Prompt: ");

      if (userInput.toLowerCase().trim() === "exit") {
        console.log("\n👋 Goodbye!");
        break;
      }

      if (!userInput.trim()) {
        continue;
      }

      try {
        const result = await coordinator.ask(userInput);
        console.log(`\n${result}`);
        console.log("-------------------\n");
      } catch (error) {
        console.error("\n❌ Error:", error instanceof Error ? error.message : error);
        console.log("-------------------\n");
      }
    }
  } finally {
    rl.close();
  }
}

// ============================================================================
// AUTONOMOUS MODE
// ============================================================================

/**
 * Runs the chatbot in autonomous mode with periodic actions
 *
 * @param coordinator - The multi-chain coordinator to interact with
 * @param interval - Time interval between actions in seconds
 * @returns {Promise<void>}
 */
async function runAutonomousMode(coordinator: EnhancedRunner, interval = 10): Promise<void> {
  console.log("🤖 Starting autonomous mode...\n");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const thought =
        "Be creative and do something interesting on the blockchain. " +
        "Choose an action or set of actions and execute it that highlights your abilities. " +
        "You can switch between networks and perform operations on different chains.";

      const result = await coordinator.ask(thought);
      console.log(`${result}`);
      console.log("-------------------\n");

      await new Promise(resolve => setTimeout(resolve, interval * 1000));
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }
}

// ============================================================================
// MODE SELECTION
// ============================================================================

/**
 * Prompts user to choose between chat and autonomous modes
 *
 * @returns {Promise<"chat" | "auto">} The selected mode
 */
async function chooseMode(): Promise<"chat" | "auto"> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  // eslint-disable-next-line no-constant-condition
  while (true) {
    console.log("\nAvailable modes:");
    console.log("1. chat    - Interactive chat mode");
    console.log("2. auto    - Autonomous action mode");

    const choice = (await question("\nChoose a mode (enter number or name): "))
      .toLowerCase()
      .trim();

    if (choice === "1" || choice === "chat") {
      rl.close();
      return "chat";
    } else if (choice === "2" || choice === "auto") {
      rl.close();
      return "auto";
    }
    console.log("Invalid choice. Please try again.");
  }
}

// ============================================================================
// MAIN
// ============================================================================

/**
 * Main entry point for the multi-chain chatbot application
 *
 * @returns {Promise<void>}
 */
async function main(): Promise<void> {
  try {
    const coordinator = await createMultiChainCoordinator();
    const mode = await chooseMode();

    if (mode === "chat") {
      await runChatMode(coordinator);
    } else {
      await runAutonomousMode(coordinator);
    }
  } catch (error) {
    console.error("Fatal error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (require.main === module) {
  console.log("🚀 Starting Multi-Chain Agent...\n");
  main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
