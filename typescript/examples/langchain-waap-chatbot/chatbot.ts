import {
  AgentKit,
  WaapWalletProvider,
  wethActionProvider,
  walletActionProvider,
  erc20ActionProvider,
  pythActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import * as readline from "readline";
import fs from "fs";

dotenv.config();

const WALLET_DATA_FILE = "wallet_data.txt";

/**
 * Validates that required environment variables are set
 *
 * @throws {Error} - If required environment variables are missing
 * @returns {void}
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];

  const requiredVars = ["OPENAI_API_KEY", "WAAP_EMAIL", "WAAP_PASSWORD"];
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

  if (!process.env.WAAP_CHAIN_ID) {
    console.warn("Warning: WAAP_CHAIN_ID not set, defaulting to 84532 (Base Sepolia)");
  }
}

// Add this right after imports and before any other code
validateEnvironment();

/**
 * Initialize the agent with WaaP AgentKit
 *
 * @returns Agent executor and config
 */
async function initializeAgent() {
  try {
    // Initialize LLM
    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
    });

    const chainId = process.env.WAAP_CHAIN_ID || "84532";

    // Configure WaaP wallet provider with auto-login
    const walletProvider = WaapWalletProvider.configureWithWallet({
      cliPath: process.env.WAAP_CLI_PATH,
      chainId,
      rpcUrl: process.env.WAAP_RPC_URL,
      email: process.env.WAAP_EMAIL,
      password: process.env.WAAP_PASSWORD,
    });

    console.log(`WaaP wallet address: ${walletProvider.getAddress()}`);
    console.log(`Network: ${JSON.stringify(walletProvider.getNetwork())}`);

    // Initialize AgentKit
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        wethActionProvider(),
        pythActionProvider(),
        walletActionProvider(),
        erc20ActionProvider(),
      ],
    });

    const tools = await getLangChainTools(agentkit);

    // Store buffered conversation history in memory
    const memory = new MemorySaver();
    const agentConfig = { configurable: { thread_id: "WaaP AgentKit Chatbot Example!" } };

    // Create React Agent using the LLM and WaaP AgentKit tools
    const agent = createAgent({
      model: llm,
      tools,
      checkpointer: memory,
      systemPrompt: `
        You are a helpful agent with a WaaP (Wallet as a Protocol) wallet that can interact onchain
        using the Coinbase Developer Platform AgentKit. Your wallet uses two-party computation (2PC)
        for key security - private keys are never fully exposed in any single location.

        You are empowered to interact onchain using your tools. If you ever need funds, you can
        request them from the faucet if you are on network ID 'base-sepolia'. If not, you can
        provide your wallet details and request funds from the user. Before executing your first
        action, get the wallet details to see what network you're on. If there is a 5XX (internal)
        HTTP error code, ask the user to try again later. If someone asks you to do something you
        can't do with your currently available tools, you must say so, and encourage them to
        implement it themselves using the CDP SDK + AgentKit, recommend they go to
        docs.cdp.coinbase.com for more information. Be concise and helpful with your responses.
        Refrain from restating your tools' descriptions unless it is explicitly requested.
        `,
    });

    // Save wallet data
    const exportedWallet = walletProvider.exportWallet();
    fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(exportedWallet));

    return { agent, config: agentConfig };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
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
  console.log("Starting WaaP Agent...");
  main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
