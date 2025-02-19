import {
  AgentKit,
  PrivyWalletProvider,
  wethActionProvider,
  walletActionProvider,
  erc20ActionProvider,
  pythActionProvider,
  PrivyWalletConfig,
  PrivyEvmWalletProvider,
  PrivySvmWalletProvider,
  cdpApiActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import * as readline from "readline";
import fs from "fs";

dotenv.config();

const WALLET_DATA_FILE = "wallet_data.txt";
const DEFAULT_CHAIN_ID = "84532"; // base-sepolia

/**
 * Validates that required environment variables are set
 *
 * @throws {Error} - If required environment variables are missing
 * @returns {void}
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];

  // Check required variables
  const requiredVars = ["OPENAI_API_KEY", "PRIVY_APP_ID", "PRIVY_APP_SECRET"];
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
}

// Add this right after imports and before any other code
validateEnvironment();

/**
 * Load saved wallet data from file if it exists
 *
 * @returns Saved wallet data or null if no data exists
 */
function loadSavedWalletData() {
  try {
    if (fs.existsSync(WALLET_DATA_FILE)) {
      return JSON.parse(fs.readFileSync(WALLET_DATA_FILE, "utf8"));
    }
  } catch {
    // Fail silently
  }
  return null;
}

/**
 * Initialize the agent with Privy Agentkit
 *
 * @returns Agent executor and config
 */
async function initializeAgent() {
  try {
    // Initialize LLM
    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
    });

    let walletProvider: PrivyEvmWalletProvider | PrivySvmWalletProvider;

    const networkId = process.env.NETWORK_ID;

    if (networkId?.includes("solana")) {
      walletProvider = await PrivyWalletProvider.configureWithWallet({
        appId: process.env.PRIVY_APP_ID as string,
        appSecret: process.env.PRIVY_APP_SECRET as string,
        walletId: process.env.PRIVY_WALLET_ID as string,
        authorizationPrivateKey: process.env.PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY,
        authorizationKeyId: process.env.PRIVY_WALLET_AUTHORIZATION_KEY_ID,
        chainType: "solana",
        networkId,
      });
    } else {
      const savedWallet = loadSavedWalletData();

      if (!process.env.CHAIN_ID && !savedWallet?.chainId) {
        console.warn("Warning: CHAIN_ID not set, defaulting to 'base-sepolia'");
      }

      const chainType = "ethereum";

      const chainId = savedWallet?.chainId || process.env.CHAIN_ID || DEFAULT_CHAIN_ID;
      const walletId = savedWallet?.walletId || (process.env.PRIVY_WALLET_ID as string);

      const authorizationPrivateKey =
        savedWallet?.authorizationPrivateKey || process.env.PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY;

      const config: PrivyWalletConfig = {
        appId: process.env.PRIVY_APP_ID as string,
        appSecret: process.env.PRIVY_APP_SECRET as string,
        authorizationKeyId: process.env.PRIVY_WALLET_AUTHORIZATION_KEY_ID,
        authorizationPrivateKey,
        chainId,
        chainType,
        walletId,
      };

      walletProvider = await PrivyWalletProvider.configureWithWallet(config);

      const exportedWallet = walletProvider.exportWallet();
      fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(exportedWallet));
    }

    // Initialize AgentKit
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        wethActionProvider(),
        pythActionProvider(),
        walletActionProvider(),
        erc20ActionProvider(),
        cdpApiActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME as string,
          apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY as string,
        }),
      ],
    });

    const tools = await getLangChainTools(agentkit);

    // Store buffered conversation history in memory
    const memory = new MemorySaver();
    const agentConfig = { configurable: { thread_id: "Privy AgentKit Chatbot Example!" } };

    // Create React Agent using the LLM and Privy AgentKit tools
    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: `
        You are a helpful agent with a Privy server wallet that can interact onchain using the Coinbase Developer
        Platform AgentKit. You are empowered to interact onchain using your tools. If you ever need funds, you can
        request them from the faucet if you are on network ID 'base-sepolia' or 'solana-devnet'. If not, you can provide your wallet
        details and request funds from the user. Before executing your first action, get the wallet details to see
        what network you're on. If there is a 5XX (internal) HTTP error code, ask the user to try again later. If
        someone asks you to do something you can't do with your currently available tools, you must say so, and
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
        if ("agent" in chunk) {
          console.log(chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
          console.log(chunk.tools.messages[0].content);
        }
        console.log("-------------------");
      }

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

      if (userInput.toLowerCase() === "exit") {
        break;
      }

      const stream = await agent.stream({ messages: [new HumanMessage(userInput)] }, config);

      for await (const chunk of stream) {
        if ("agent" in chunk) {
          console.log(chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
          console.log(chunk.tools.messages[0].content);
        }
        console.log("-------------------");
      }
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
