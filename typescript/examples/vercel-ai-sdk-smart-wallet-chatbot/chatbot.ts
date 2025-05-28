import {
  AgentKit,
  cdpApiActionProvider,
  erc721ActionProvider,
  pythActionProvider,
  walletActionProvider,
  SmartWalletProvider,
} from "@coinbase/agentkit";
import { getVercelAITools } from "@coinbase/agentkit-vercel-ai-sdk";
import { openai } from "@ai-sdk/openai";
import { generateId, Message, streamText, ToolSet } from "ai";
import * as dotenv from "dotenv";
import * as readline from "readline";
import * as fs from "fs";
import { Address, Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

dotenv.config();

type WalletData = {
  privateKey: Hex;
  smartWalletAddress: Address;
};

/**
 * Validates that required environment variables are set
 *
 * @throws {Error} - If required environment variables are missing
 * @returns {void}
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];

  // Check required variables
  const requiredVars = ["OPENAI_API_KEY", "CDP_API_KEY_ID", "CDP_API_KEY_SECRET"];
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

const system = `You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit. You are
empowered to interact onchain using your tools. If you ever need funds, you can request them from the
faucet if you are on network ID 'base-sepolia'. If not, you can provide your wallet details and request
funds from the user. Before executing your first action, get the wallet details to see what network
you're on. If there is a 5XX (internal) HTTP error code, ask the user to try again later. If someone
asks you to do something you can't do with your currently available tools, you must say so, and
encourage them to implement it themselves using the CDP SDK + Agentkit, recommend they go to
docs.cdp.coinbase.com for more information. Be concise and helpful with your responses. Refrain from
restating your tools' descriptions unless it is explicitly requested.`;

/**
 * Initialize the agent with CDP Agentkit and Vercel AI SDK tools
 *
 * @returns Object containing initialized tools
 * @throws Error if initialization fails
 */
async function initializeAgent() {
  try {
    const networkId = process.env.NETWORK_ID || "base-sepolia";
    const walletDataFile = `wallet_data_${networkId.replace(/-/g, "_")}.txt`;

    let walletData: WalletData | null = null;
    let privateKey: Hex | null = null;

    // Read existing wallet data if available
    if (fs.existsSync(walletDataFile)) {
      try {
        walletData = JSON.parse(fs.readFileSync(walletDataFile, "utf8")) as WalletData;
        privateKey = walletData.privateKey;
      } catch (error) {
        console.error(`Error reading wallet data for ${networkId}:`, error);
        // Continue without wallet data
      }
    }

    if (!privateKey) {
      if (walletData?.smartWalletAddress) {
        throw new Error(
          `Smart wallet found but no private key provided. Either provide the private key, or delete ${walletDataFile} and try again.`,
        );
      }
      privateKey = (process.env.PRIVATE_KEY || generatePrivateKey()) as Hex;
    }

    const signer = privateKeyToAccount(privateKey);

    // Configure Smart Wallet Provider
    const walletProvider = await SmartWalletProvider.configureWithWallet({
      networkId,
      signer,
      smartWalletAddress: walletData?.smartWalletAddress,
      paymasterUrl: undefined, // Sponsor transactions: https://docs.cdp.coinbase.com/paymaster/docs/welcome
    });

    const agentKit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        cdpApiActionProvider({
          apiKeyId: process.env.CDP_API_KEY_ID,
          apiKeySecret: process.env.CDP_API_KEY_SECRET,
        }),
        erc721ActionProvider(),
        pythActionProvider(),
        walletActionProvider(),
      ],
    });

    // Save wallet data
    const smartWalletAddress = await walletProvider.getAddress();
    fs.writeFileSync(
      walletDataFile,
      JSON.stringify({
        privateKey,
        smartWalletAddress,
      } as WalletData),
    );

    const tools = getVercelAITools(agentKit);
    return { tools };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
}

/**
 * Run the chatbot in interactive mode
 *
 * @param tools - Record of Vercel AI SDK tools from AgentKit
 * @returns Promise that resolves when chat session ends
 */
async function runChatMode(tools: ToolSet) {
  console.log("Starting chat mode... Type 'exit' to end.");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  const messages: Message[] = [];
  let running = true;

  try {
    while (running) {
      const userInput = await question("\nPrompt: ");

      if (userInput.toLowerCase() === "exit") {
        running = false;
        continue;
      }

      messages.push({ id: generateId(), role: "user", content: userInput });

      const stream = streamText({
        model: openai("gpt-4o-mini"),
        messages,
        tools,
        system,
        maxSteps: 10,
      });

      let assistantMessage = "";
      for await (const chunk of stream.textStream) {
        process.stdout.write(chunk);
        assistantMessage += chunk;
      }
      console.log("\n-------------------");

      messages.push({ id: generateId(), role: "assistant", content: assistantMessage });
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    rl.close();
  }
}

/**
 * Run the agent autonomously with specified intervals
 *
 * @param tools - Record of Vercel AI SDK tools from AgentKit
 * @param interval - Time interval between actions in seconds
 */
async function runAutonomousMode(tools: ToolSet, interval = 10) {
  console.log("Starting autonomous mode...");

  const messages: Message[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const thought =
        "Be creative and do something interesting on the blockchain. " +
        "Choose an action or set of actions and execute it that highlights your abilities.";

      messages.push({ id: generateId(), role: "user", content: thought });

      const stream = streamText({
        model: openai("gpt-4o-mini"),
        messages,
        tools,
        system,
        maxSteps: 10,
      });

      let assistantMessage = "";
      for await (const chunk of stream.textStream) {
        process.stdout.write(chunk);
        assistantMessage += chunk;
      }
      console.log("\n-------------------");

      messages.push({ id: generateId(), role: "assistant", content: assistantMessage });

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
 * Main entry point for the chatbot application
 * Initializes the agent and starts chat mode
 *
 * @throws Error if initialization or chat mode fails
 */
async function main() {
  try {
    const { tools } = await initializeAgent();
    const mode = await chooseMode();
    if (mode === "chat") {
      await runChatMode(tools);
    } else {
      await runAutonomousMode(tools);
    }
  } catch (error) {
    console.error("Error:", error);
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
