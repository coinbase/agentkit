import {
  AgentKit,
  ViemWalletProvider,
  ActionProvider,
  WalletProvider,
  okxDexActionProvider,
  NETWORK_ID_TO_VIEM_CHAIN
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import * as readline from "readline";
import * as fs from "fs";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

dotenv.config();

// Constants for Base network
const BASE_CHAIN_ID = "8453";
const BASE_NETWORK_NAME = "Base";

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
 * Initialize the agent with OKX DEX provider for Base EVM network
 *
 * @returns Agent executor and config
 */
async function initializeAgent() {
  try {
    // Initialize LLM
    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
    });

    // Configure EVM Wallet Provider for Base
    const privateKey = process.env.EVM_PRIVATE_KEY as `0x${string}`;
    if (!privateKey) {
      console.log(`No EVM account detected. Generating a wallet...`);
      const { generatePrivateKey } = await import('viem/accounts');
      const newPrivateKey = generatePrivateKey();
      fs.appendFileSync(".env", `EVM_PRIVATE_KEY=${newPrivateKey}\n`);
      console.log(`Created EVM wallet: ${newPrivateKey}`);
      console.log("The private key for this wallet has been automatically saved to your .env file");
    }

    const rpcUrl = process.env.BASE_RPC_URL;
    let walletProvider: WalletProvider;
    if (rpcUrl) {
      const client = createWalletClient({
        account: privateKeyToAccount(privateKey),
        chain: NETWORK_ID_TO_VIEM_CHAIN["base-mainnet"],
        transport: http(rpcUrl),
      });
      walletProvider = new ViemWalletProvider(client);
    } else {
      const client = createWalletClient({
        account: privateKeyToAccount(privateKey),
        chain: NETWORK_ID_TO_VIEM_CHAIN["base-mainnet"],
        transport: http(),
      });
      walletProvider = new ViemWalletProvider(client);
    }

    // Initialize action providers array
    const actionProviders: ActionProvider[] = [];

    // Add OKX DEX provider if credentials are available
    const okxCredentialsAvailable = process.env.OKX_API_KEY && 
      process.env.OKX_SECRET_KEY && 
      process.env.OKX_API_PASSPHRASE && 
      process.env.OKX_PROJECT_ID;
    
    if (okxCredentialsAvailable) {
      try {
        const okxProvider = okxDexActionProvider();
        actionProviders.push(okxProvider);
        console.log("OKX DEX provider initialized successfully");
      } catch (error) {
        console.warn("Failed to initialize OKX DEX provider:", error);
      }
    }

    // Initialize AgentKit
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders,
    });

    const tools = await getLangChainTools(agentkit);

    // Store buffered conversation history in memory
    const memory = new MemorySaver();
    const agentConfig = { configurable: { thread_id: "Base EVM OKX DEX AgentKit Chatbot!" } };

    // Create React Agent using the LLM and AgentKit tools
    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: `
        You are a helpful agent specialized in performing DEX operations on the Base EVM network (chain ID: ${BASE_CHAIN_ID}) using OKX DEX.
        
        For OKX DEX operations on Base:
        - You can get swap quotes for tokens on the Base network
        - When using OKX DEX tools, always use chainId "${BASE_CHAIN_ID}" for Base
        - Use the get_swap_quote action to fetch pricing for token swaps
        - Focus primarily on Base tokens and pairs (e.g., ETH on Base, USDC on Base)
        
        Common Base token addresses:
        - Base ETH (Native): 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE
        - USDC on Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
        - DAI on Base: 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb
        - USDT on Base: 0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA
        
        When using the get_swap_quote action, ensure you always use these parameters:
        - chainId: "${BASE_CHAIN_ID}" - Always use Base network chain ID
        - fromTokenAddress: The token address you're swapping from
        - toTokenAddress: The token address you're swapping to
        - amount: Amount in wei format (with all decimals)
        - slippage: Optional parameter specifying maximum acceptable slippage (default "0.5")
        
        If there is a 5XX (internal) HTTP error code, ask the user to try again later.
        
        If someone asks you to do something you can't do with your currently available tools, you must say so,
        and encourage them to implement it themselves using the OKX DEX API.
        Recommend they go to the OKX DEX documentation for more information.
        
        Be concise and helpful with your responses. Refrain from restating your tools' descriptions unless
        it is explicitly requested.
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