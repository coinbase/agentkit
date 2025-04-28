import {
  AgentKit,
  SOLANA_NETWORK_ID,
  SolanaKeypairWalletProvider,
  okxDexActionProvider,
  ActionProvider,
  Network
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { Keypair } from "@solana/web3.js";
import * as dotenv from "dotenv";
import * as readline from "readline";
import * as fs from "fs";
import("bs58")

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
  const requiredVars = ["OPENAI_API_KEY"];
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

  // Warn about optional SOLANA_RPC_URL & NETWORK_ID
  if (!process.env.SOLANA_RPC_URL && !process.env.NETWORK_ID) {
    console.warn(
      "Warning: SOLANA_RPC_URL and NETWORK_ID both are unset, defaulting to solana-devnet",
    );
  }

  // Check OKX API credentials
  const okxVars = ["OKX_API_KEY", "OKX_SECRET_KEY", "OKX_API_PASSPHRASE", "OKX_PROJECT_ID"];
  const missingOkxVars = okxVars.filter(varName => !process.env[varName]);
  
  if (missingOkxVars.length > 0) {
    console.warn("Warning: Some OKX API credentials are missing. OKX DEX actions will not be available.");
    console.warn("Required OKX environment variables:");
    missingOkxVars.forEach(varName => {
      console.warn(`${varName}=your_${varName.toLowerCase()}_here`);
    });
  }
}

// Add this right after imports and before any other code
validateEnvironment();

/**
 * Initialize the agent with CDP Agentkit and OKX DEX
 *
 * @returns Agent executor and config
 */
async function initializeAgent() {
  try {
    // Initialize LLM
    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
    });

    // Configure Solana Keypair Wallet Provider
    const privateKey = process.env.SOLANA_PRIVATE_KEY as string;
    if (!privateKey) {
      throw new Error("SOLANA_PRIVATE_KEY environment variable is required");
    }
    const network = "solana-mainnet" as SOLANA_NETWORK_ID;
    const walletProvider = await SolanaKeypairWalletProvider.fromNetwork(network, privateKey);

    // Initialize action providers array with only OKX DEX
    const actionProviders: ActionProvider[] = [];

    // Add OKX DEX provider if credentials are available
    const okxCredentialsAvailable = process.env.OKX_API_KEY && 
      process.env.OKX_SECRET_KEY && 
      process.env.OKX_API_PASSPHRASE && 
      process.env.OKX_PROJECT_ID;
    
    if (okxCredentialsAvailable) {
      try {
        console.log("Initializing OKX DEX provider...");
        const okxProvider = okxDexActionProvider({
          apiKey: process.env.OKX_API_KEY,
          secretKey: process.env.OKX_SECRET_KEY,
          apiPassphrase: process.env.OKX_API_PASSPHRASE,
          projectId: process.env.OKX_PROJECT_ID
        });
        
        // Override the supportsNetwork method to always return true for Solana
        okxProvider.supportsNetwork = (network: Network) => {
          return network.protocolFamily === 'svm' && network.networkId === 'solana-mainnet';
        };
        
        actionProviders.push(okxProvider);
        console.log("OKX DEX provider added successfully");
      } catch (error) {
        console.warn("Failed to initialize OKX DEX provider:", error);
      }
    } else {
      console.log("OKX DEX provider not initialized due to missing credentials");
    }

    // Initialize AgentKit
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders,
    });

    const tools = await getLangChainTools(agentkit);

    // Store buffered conversation history in memory
    const memory = new MemorySaver();
    const agentConfig = { configurable: { thread_id: "Solana AgentKit Chatbot with OKX DEX!" } };

    // Create React Agent using the LLM and Solana AgentKit tools
    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: `
        You are a helpful agent that can interact onchain on Solana using the Coinbase Developer Platform AgentKit.
        
        You also have access to OKX DEX operations on Solana if the credentials are properly configured.
        
        For OKX DEX operations on Solana:
        - You can get swap quotes for tokens on the Solana network
        - Use the get_swap_quote action to fetch pricing for token swaps
        - Focus primarily on Solana tokens and pairs
        
        Common Solana token addresses:
        - SOL (Native): 11111111111111111111111111111111
        - USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
        - USDT: Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB

        If a user says they want to swap SOL to USDC or USDC, then refrence the addresses above
        
        When using the get_swap_quote action, ensure you always use these parameters:
        - fromTokenAddress: The token address you're swapping from
        - toTokenAddress: The token address you're swapping to
        - amount: Amount in lamports (for SOL) or token decimals
        - slippage: Optional parameter specifying maximum acceptable slippage (default "0.5")
        
        If there is a 5XX (internal) HTTP error code, ask the user to try again later. If someone 
        asks you to do something you can't do with your currently available tools, you must say so, and 
        encourage them to implement it themselves using the CDP SDK + Agentkit, recommend they go to 
        docs.cdp.coinbase.com for more information. Be concise and helpful with your responses. Refrain from 
        restating your tools' descriptions unless it is explicitly requested.

        Summarize complex JSON data into a human readable format 
        The user just needs to know the exchange rate and the out amount
        For Gas Fee Estimate use SOL converted from Lamports and then in USDC
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
  console.log("-------------------");
  console.log("Welcome to the Solana AgentKit Chatbot with OKX DEX support!");
  console.log("You can ask me to perform various operations on the Solana network.");
  console.log("Examples:");
  console.log("- 'Get a swap quote for SOL to USDC for 10 SOL'");
  console.log("-------------------");

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