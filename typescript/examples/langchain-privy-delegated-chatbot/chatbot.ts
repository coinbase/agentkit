import {
  AgentKit,
  PrivyWalletProvider,
  wethActionProvider,
  walletActionProvider,
  erc20ActionProvider,
  pythActionProvider,
  cdpApiActionProvider,
  PrivyEvmEmbeddedWalletProvider,
  cdpWalletActionProvider,
} from "../../agentkit/src";
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
    "PRIVY_APP_ID",
    "PRIVY_APP_SECRET",
    "PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY",
    "PRIVY_DELEGATED_WALLET_ID", // Required for embedded wallet
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
}

// Add this right after imports and before any other code
validateEnvironment();

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

    let walletProvider: PrivyEvmEmbeddedWalletProvider;

    const networkId = process.env.NETWORK_ID || "base";

    if (networkId?.includes("solana")) {
      console.error("Embedded wallet for Solana not implemented in this example");
      process.exit(1);
    } else {
      walletProvider = await PrivyWalletProvider.configureWithWallet({
        appId: process.env.PRIVY_APP_ID!,
        appSecret: process.env.PRIVY_APP_SECRET!,
        authorizationPrivateKey: process.env.PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY,
        walletId: process.env.PRIVY_DELEGATED_WALLET_ID,
        networkId: "base",
        walletType: "embedded",
      });
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
        cdpWalletActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME as string,
          apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY as string,
        }),
      ],
    });

    const tools = await getLangChainTools(agentkit);

    // Store buffered conversation history in memory
    const memory = new MemorySaver();
    const agentConfig = { configurable: { thread_id: "Privy Embedded Wallet AgentKit Example!" } };

    // Create React Agent using the LLM and Privy AgentKit tools
    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: `
        You are a helpful agent with a Privy embedded wallet that has been delegated to you. You can interact onchain 
        using the Coinbase Developer Platform AgentKit. You are empowered to interact onchain using your tools. Before 
        executing your first action, get the wallet details to see what network you're on and your available balance.
        
        If there is a 5XX (internal) HTTP error code, ask the user to try again later. If someone asks you to do 
        something you can't do with your currently available tools, you must say so, and encourage them to implement 
        it themselves using the CDP SDK + Agentkit, recommend they go to docs.cdp.coinbase.com for more information.
        
        Be concise and helpful with your responses. Refrain from restating your tools' descriptions unless it is 
        explicitly requested.
        `,
    });

    // Save wallet data
    const exportedWallet = walletProvider.exportWallet();
    fs.writeFileSync(
      WALLET_DATA_FILE,
      JSON.stringify({
        ...exportedWallet,
        walletType: "embedded", // Add this to identify it as an embedded wallet
      }),
    );

    console.log("Agent initialized with wallet address:", walletProvider.getAddress());
    return { agent, config: agentConfig };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error; // Re-throw to be handled by caller
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
 * Start the chatbot agent
 */
async function main() {
  try {
    console.log("Initializing agent with Privy embedded wallet...");
    const { agent, config } = await initializeAgent();
    await runChatMode(agent, config);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  console.log("Starting Agent with Privy Embedded Wallet...");
  main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
