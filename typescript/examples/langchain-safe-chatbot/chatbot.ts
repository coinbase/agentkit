import { config as loadEnv } from "dotenv";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import {
  AgentKit,
  walletActionProvider,
  SafeWalletProvider,
  safeWalletActionProvider,
  safeApiActionProvider,
  erc20ActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";

import * as readline from "readline";

// Load environment variables
loadEnv();

/**
 * Validate environment variables. If missing or invalid, exit.
 */
function validateEnv() {
  const missing: string[] = [];
  if (!process.env.OPENAI_API_KEY) {
    missing.push("OPENAI_API_KEY");
  }
  if (!process.env.SAFE_OWNER_PRIVATE_KEY) {
    missing.push("SAFE_OWNER_PRIVATE_KEY");
  }
  if (missing.length > 0) {
    console.error("Missing required environment variables:", missing.join(", "));
    process.exit(1);
  }
}

validateEnv();

/**
 * Choose whether to run in chat or auto mode
 *
 * @returns The selected mode
 */
async function chooseMode(): Promise<"chat" | "auto"> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string) => new Promise<string>(resolve => rl.question(prompt, resolve));

  // eslint-disable-next-line no-constant-condition
  while (true) {
    console.log("\nAvailable modes:");
    console.log("1. chat  - Interactive chat mode");
    console.log("2. auto  - Autonomous action mode");

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
 * Initialize the Safe-based agent
 *
 * @returns Agent executor and config
 */
async function initializeAgent() {
  // Initialize LLM
  const llm = new ChatOpenAI({
    model: "gpt-4o-mini", // example model name
  });

  // Configure SafeWalletProvider
  const privateKey = process.env.SAFE_OWNER_PRIVATE_KEY as string;
  const networkId = process.env.NETWORK_ID || "base-sepolia";
  const safeAddress = process.env.SAFE_ADDRESS;
  const safeWallet = new SafeWalletProvider({
    privateKey,
    networkId,
    safeAddress,
  });
  await safeWallet.waitForInitialization();

  // Initialize AgentKit with the Safe wallet and some typical action providers
  const agentkit = await AgentKit.from({
    walletProvider: safeWallet,
    actionProviders: [
      walletActionProvider(),
      safeWalletActionProvider(),
      safeApiActionProvider({ networkId: networkId }),
      erc20ActionProvider(),
    ],
  });

  const tools = await getLangChainTools(agentkit);

  // Store buffered conversation history in memory
  const memory = new MemorySaver();
  const agentConfig = { configurable: { thread_id: "Safe AgentKit Chatbot Example!" } };

  // Create the agent
  const agent = createReactAgent({
    llm,
    tools,
    checkpointSaver: memory,
    messageModifier: `
      You are a helpful agent with a Safe multi-sig wallet that can interact onchain using the Coinbase Developer
      Platform AgentKit. You are empowered to interact onchain using your tools. 
      If there are multiple owners (signers) and threshold > 1, you can propose transactions that need confirmations from other signers before they can be executed.
      If threshold=1, you can execute immediately. You can also approve (and eventually execute) pending transactions proposed by other owners.
      If you ever need funds, you can request them from the faucet if you are on network ID 'base-sepolia'. If not, you can provide your wallet
      details and request funds from the user. 
      Before executing your first action, get the wallet details to see what network you're on. If there is a 5XX (internal) HTTP error code, ask the user to try again later. 
      If someone asks you to do something you can't do with your currently available tools, you must say so, and
      encourage them to implement it themselves using the CDP SDK + Agentkit, recommend they go to
      docs.cdp.coinbase.com for more information. Be concise and helpful with your responses. Refrain from
      restating your tools' descriptions unless it is explicitly requested.
    `,
  });

  return { agent, config: agentConfig };
}

/**
 * Run the agent in chat mode
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runChatMode(agent: any, config: any) {
  console.log("Starting chat mode... Type 'exit' or Ctrl+C to exit.\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string) => new Promise<string>(resolve => rl.question(prompt, resolve));

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const userInput = await question("Prompt: ");

    if (userInput.toLowerCase() === "exit") {
      rl.close();
      break;
    }

    const stream = await agent.stream({ messages: [new HumanMessage(userInput)] }, config);

    for await (const chunk of stream) {
      if ("agent" in chunk) {
        console.log(chunk.agent.messages[0].content);
      } else if ("tools" in chunk) {
        console.log(chunk.tools.messages[0].content);
      }
      console.log("------------------------------------------");
    }
  }
}

/**
 * Demonstration of an autonomous loop
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 * @param interval - Time interval between actions in seconds
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runAutoMode(agent: any, config: any, interval = 15) {
  console.log("Starting autonomous mode. Press Ctrl+C to exit.\n");
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const thought =
        "Pick a creative onchain action that demonstrates Safe usage. Execute or propose it. Summarize progress.";

      const stream = await agent.stream({ messages: [new HumanMessage(thought)] }, config);

      for await (const chunk of stream) {
        if ("agent" in chunk) {
          console.log(chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
          console.log(chunk.tools.messages[0].content);
        }
        console.log("------------------------------------------");
      }

      // Wait <interval> seconds between iterations
      await new Promise(resolve => setTimeout(resolve, interval * 1000));
    } catch (err) {
      console.error("Error in auto mode:", err);
      process.exit(1);
    }
  }
}

/**
 * Main entrypoint
 */
async function main() {
  try {
    const { agent, config } = await initializeAgent();
    const mode = await chooseMode();

    if (mode === "chat") {
      await runChatMode(agent, config);
    } else {
      await runAutoMode(agent, config);
    }
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
