import {
  AgentKit,
  CdpEvmWalletProvider,
  walletActionProvider,
  erc20ActionProvider,
  cdpApiActionProvider,
  cdpEvmWalletActionProvider,
  erc8004IdentityActionProvider,
  erc8004ReputationActionProvider,
  getAgent0SDK,
  getChainIdFromNetwork,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import * as readline from "readline";

dotenv.config();

/**
 * Validates that required environment variables are set
 *
 * @throws {Error} - If required environment variables are missing
 * @returns {void}
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];

  // Check required variables
  const requiredVars = [
    "OPENAI_API_KEY",
    "CDP_API_KEY_ID",
    "CDP_API_KEY_SECRET",
    "CDP_WALLET_SECRET",
  ];
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  // Exit if any required variables are missing
  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach(varName => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }

  // Warn about optional NETWORK_ID
  if (!process.env.NETWORK_ID) {
    console.warn("Warning: NETWORK_ID not set, defaulting to base-sepolia testnet");
  }
}

// Add this right after imports and before any other code
validateEnvironment();

/**
 * Resolves the agent ID for this chatbot session.
 * Priority: AGENT_ID env var → most recent owned agent → register new.
 *
 * @param walletProvider - The EVM wallet provider
 * @returns The fully-qualified agent ID (chainId:numericId)
 */
async function resolveAgentId(walletProvider: CdpEvmWalletProvider): Promise<string> {
  const sdk = getAgent0SDK(walletProvider);
  const network = walletProvider.getNetwork();
  const chainId = getChainIdFromNetwork(network);
  const walletAddress = walletProvider.getAddress();

  const ensureFullId = (id: string) => (id.includes(":") ? id : `${chainId}:${id}`);

  if (process.env.AGENT_ID) {
    const fullId = ensureFullId(process.env.AGENT_ID);
    const agent = await sdk.getAgent(fullId);
    if (!agent) {
      throw new Error(`Agent ${fullId} not found on chain ${chainId}`);
    }
    console.log(`Loaded agent from AGENT_ID env: ${fullId} (${agent.name || "Unnamed"})`);
    return fullId;
  }

  const owned = await sdk.searchAgents({ owners: [walletAddress], chains: [chainId] });
  if (owned.length > 0) {
    const sorted = [...owned].sort((a, b) => {
      const numA = parseInt(a.agentId.split(":").pop()!, 10);
      const numB = parseInt(b.agentId.split(":").pop()!, 10);
      return numB - numA;
    });
    const mostRecent = sorted[0];
    const fullId = ensureFullId(mostRecent.agentId);
    console.log(
      `Found ${owned.length} owned agent(s). Using most recent: ${fullId} (${mostRecent.name || "Unnamed"})`,
    );
    return fullId;
  }

  console.log("No agents found for this wallet. Registering new agent...");
  const agent = sdk.createAgent(
    "CDP AgentKit Chatbot",
    "A helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit.",
  );
  const handle = await agent.registerOnChain();
  const { result } = await handle.waitMined();
  const fullId = ensureFullId(String(result.agentId));
  console.log(`New agent registered: ${fullId} (tx: ${handle.hash})`);
  return fullId;
}

/**
 * Initialize the agent with CDP Agentkit
 *
 * @returns Agent executor and config
 */
async function initializeAgent() {
  try {
    // Initialize LLM
    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
    });

    // Configure CDP Wallet Provider
    const networkId = process.env.NETWORK_ID || "base-sepolia";

    const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
      apiKeyId: process.env.CDP_API_KEY_ID,
      apiKeySecret: process.env.CDP_API_KEY_SECRET,
      walletSecret: process.env.CDP_WALLET_SECRET,
      idempotencyKey: process.env.IDEMPOTENCY_KEY,
      address: process.env.ADDRESS as `0x${string}` | undefined,
      networkId,
      rpcUrl: process.env.RPC_URL,
    });

    console.log(`Wallet address: ${walletProvider.getAddress()}`);
    console.log(`Network: ${networkId}`);

    const agentId = await resolveAgentId(walletProvider);
    console.log(`Agent ID: ${agentId}`);

    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        walletActionProvider(),
        erc20ActionProvider(),
        cdpApiActionProvider(),
        cdpEvmWalletActionProvider(),
        erc8004IdentityActionProvider({ pinataJwt: process.env.PINATA_JWT }),
        erc8004ReputationActionProvider({ pinataJwt: process.env.PINATA_JWT }),
      ],
    });

    const tools = await getLangChainTools(agentkit);

    // Store buffered conversation history in memory
    const memory = new MemorySaver();
    const agentConfig = { configurable: { thread_id: "CDP AgentKit Chatbot Example!" } };

    // Create React Agent using the LLM and CDP AgentKit tools
    const agent = createAgent({
      model: llm,
      tools,
      checkpointer: memory,
      systemPrompt: `
        You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit. You are 
        empowered to interact onchain using your tools. 

        Your registered agent ID is ${agentId} and you are on network ${networkId}. 
        Your wallet address is ${walletProvider.getAddress()}.

        If you ever need funds, you can request them from the 
        faucet if you are on network ID 'base-sepolia'. If not, you can provide your wallet details and request 
        funds from the user. 
        
        If someone asks you to do something you can't do with your currently available tools, you must say so, and 
        encourage them to implement it themselves using the CDP SDK + Agentkit, recommend they go to 
        docs.cdp.coinbase.com for more information. Be concise and helpful with your responses. Refrain from 
        restating your tools' descriptions unless it is explicitly requested.
        `,
    });

    return { agent, config: agentConfig };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error; // Re-throw to be handled by caller
  }
}

/**
 * Run the agent autonomously with specified intervals
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 * @param interval - Time interval between actions in seconds
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runAutonomousMode(agent: any, config: any, interval = 10) {
  console.log("Starting autonomous mode...");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const thought =
        "Be creative and do something interesting on the blockchain. " +
        "Choose an action or set of actions and execute it that highlights your abilities.";

      const stream = await agent.stream({ messages: [new HumanMessage(thought)] }, config);

      for await (const chunk of stream) {
        if ("model_request" in chunk) {
          const response = chunk.model_request.messages[0].content;
          if (response !== "") {
            console.log("\n Response: " + response);
          }
        }
        if ("tools" in chunk) {
          for (const tool of chunk.tools.messages) {
            console.log("Tool " + tool.name + ": " + tool.content);
          }
        }
      }
      console.log("-------------------");

      await new Promise(resolve => setTimeout(resolve, interval * 1000));
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error:", error.message);
      }
      process.exit(1);
    }
  }
}

/**
 * Run the agent interactively based on user input
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runChatMode(agent: any, config: any) {
  console.log("Starting chat mode... Type 'exit' to end.");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const userInput = await question("\nPrompt: ");
      console.log("-------------------");

      if (userInput.toLowerCase() === "exit") {
        break;
      }

      const stream = await agent.stream({ messages: [new HumanMessage(userInput)] }, config);

      for await (const chunk of stream) {
        if ("model_request" in chunk) {
          const response = chunk.model_request.messages[0].content;
          if (response != "") {
            console.log("\n Response: " + response);
          }
        }
        if ("tools" in chunk) {
          for (const tool of chunk.tools.messages) {
            console.log("Tool " + tool.name + ": " + tool.content);
          }
        }
      }
      console.log("-------------------");
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

/**
 * Choose whether to run in autonomous or chat mode based on user input
 *
 * @returns Selected mode
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

/**
 * Start the chatbot agent
 */
async function main() {
  try {
    const { agent, config } = await initializeAgent();
    const mode = await chooseMode();

    if (mode === "chat") {
      await runChatMode(agent, config);
    } else {
      await runAutonomousMode(agent, config);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  console.log("Starting Agent...");
  main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
