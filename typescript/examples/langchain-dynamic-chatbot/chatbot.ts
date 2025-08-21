import {
  AgentKit,
  DynamicSvmWalletProvider,
  wethActionProvider,
  walletActionProvider,
  erc20ActionProvider,
  pythActionProvider,
  cdpApiActionProvider,
  splActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import * as readline from "node:readline";
import * as fs from "node:fs";
import { ThresholdSignatureScheme } from "@dynamic-labs-wallet/node";

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

  // Check required variables
  const requiredVars = ["OPENAI_API_KEY", "DYNAMIC_AUTH_TOKEN", "DYNAMIC_ENVIRONMENT_ID"];
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  // Exit if any required variables are missing
  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    for (const varName of missingVars) {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    }
    process.exit(1);
  }
}

// Add this right after imports and before any other code
validateEnvironment();

/**
 * Initialize the agent with Dynamic Agentkit
 *
 * @returns Agent executor and config
 */
async function initializeAgent() {
  try {
    // Initialize LLM
    const llm = new ChatOpenAI({
      modelName: "gpt-4o-mini",
    });

    const networkId = process.env.NETWORK_ID || "mainnet-beta";

    // Configure Dynamic wallet provider
    const baseApiUrl = process.env.DYNAMIC_BASE_API_URL || "https://app.dynamicauth.com";
    const baseMPCRelayApiUrl = process.env.DYNAMIC_BASE_MPC_RELAY_API_URL || "relay.dynamicauth.com";
  
    const walletConfig = {
      authToken: process.env.DYNAMIC_AUTH_TOKEN as string,
      environmentId: process.env.DYNAMIC_ENVIRONMENT_ID as string,
      baseApiUrl,
      baseMPCRelayApiUrl,
      networkId,
      chainType: "solana" as const,
      thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_TWO,
    };

    const walletProvider = await DynamicSvmWalletProvider.configureWithWallet(walletConfig);

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
        splActionProvider(),
      ],
    });

    const tools = await getLangChainTools(agentkit);

    // Store buffered conversation history in memory
    const memory = new MemorySaver();
    const agentConfig = { configurable: { thread_id: "Dynamic AgentKit Chatbot Example!" } };

    // Create React Agent using the LLM and Dynamic AgentKit tools
    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: `
        You are a helpful agent with a Dynamic wallet that can interact onchain using the Coinbase Developer
        Platform AgentKit. You are empowered to interact onchain using your tools. If you ever need funds, you can
        request them from the faucet if you are on network ID 'solana-devnet'. If not, you can provide your wallet
        details and request funds from the user. Before executing your first action, get the wallet details to see
        what network you're on. If there is a 5XX (internal) HTTP error code, ask the user to try again later. If
        someone asks you to do something you can't do with your currently available tools, you must say so, and
        encourage them to implement it themselves using the CDP SDK + Agentkit, recommend they go to
        docs.cdp.coinbase.com for more information. Be concise and helpful with your responses. Refrain from
        restating your tools' descriptions unless it is explicitly requested.
        `,
    });

    // Save wallet data
    const exportedWallet = walletProvider.exportWallet();
    fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(exportedWallet));

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
async function runAutonomousMode(
  agent: ReturnType<typeof createReactAgent>,
  config: { configurable: { thread_id: string } },
  interval = 10
) {
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
          console.log(chunk.agent);
        }
      }

      console.log(`Waiting ${interval} seconds before next action...`);
      await new Promise(resolve => setTimeout(resolve, interval * 1000));
    } catch (error) {
      console.error("Error in autonomous mode:", error);
      await new Promise(resolve => setTimeout(resolve, interval * 1000));
    }
  }
}

/**
 * Run the agent in chat mode
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 */
async function runChatMode(
  agent: ReturnType<typeof createReactAgent>,
  config: { configurable: { thread_id: string } }
) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  console.log("Starting chat mode...");
  console.log("Type 'exit' to quit");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const userInput = await question("\nYou: ");

      if (userInput.toLowerCase() === "exit") {
        rl.close();
        break;
      }

      const stream = await agent.stream({ messages: [new HumanMessage(userInput)] }, config);

      for await (const chunk of stream) {
        if ("agent" in chunk) {
          console.log(chunk.agent);
        }
      }
    } catch (error) {
      console.error("Error in chat mode:", error);
    }
  }
}

/**
 * Choose between chat and autonomous modes
 *
 * @returns The chosen mode
 */
async function chooseMode(): Promise<"chat" | "auto"> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  while (true) {
    const mode = await question("Choose mode (chat/auto): ");
    if (mode.toLowerCase() === "chat" || mode.toLowerCase() === "auto") {
      rl.close();
      return mode.toLowerCase() as "chat" | "auto";
    }
    console.log("Invalid mode. Please choose 'chat' or 'auto'");
  }
}

/**
 * Main function
 */
async function main() {
  try {
    const { agent, config } = await initializeAgent();
    const mode = await chooseMode();

    if (mode === "auto") {
      await runAutonomousMode(agent, config);
    } else {
      await runChatMode(agent, config);
    }
  } catch (error) {
    console.error("Failed to start agent:", error);
    process.exit(1);
  }
}

main();
