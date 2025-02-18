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
  if (!process.env.SAFE_AGENT_PRIVATE_KEY) {
    missing.push("SAFE_AGENT_PRIVATE_KEY");
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
  // 1) Create an LLM
  const llm = new ChatOpenAI({
    model: "gpt-4o-mini", // example model name
  });

  // 2) Configure SafeWalletProvider
  const privateKey = process.env.SAFE_AGENT_PRIVATE_KEY as string;
  const networkId = process.env.NETWORK_ID || "base-sepolia";
  const safeAddress = process.env.SAFE_ADDRESS;
  const safeWallet = new SafeWalletProvider({
    privateKey,
    networkId,
    safeAddress,
  });

  // 3) Initialize AgentKit with the Safe wallet and some typical action providers
  const agentkit = await AgentKit.from({
    walletProvider: safeWallet,
    actionProviders: [
      walletActionProvider(),
      safeWalletActionProvider(),
      safeApiActionProvider({ networkId: networkId }),
    ],
  });

  // 4) Convert to LangChain tools
  const tools = await getLangChainTools(agentkit);

  // 5) Wrap in a memory saver for conversation
  const memory = new MemorySaver();
  const agentConfig = { configurable: { thread_id: "Safe AgentKit Chatbot Example!" } };

  // 6) Create the agent
  const agent = createReactAgent({
    llm,
    tools,
    checkpointSaver: memory,
    messageModifier: `
      You are an agent with a Safe-based wallet. You can propose or execute actions
      on the Safe. If threshold > 1, you may need confirmations from other signers
      or to propose transactions. If threshold=1, you can execute immediately.
      Be concise and helpful. If you cannot fulfill a request with your current tools,
      apologize and suggest the user implement it themselves. 
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
