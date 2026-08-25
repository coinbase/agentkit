import {
  AgentKit,
  CdpSmartWalletProvider,
  wethActionProvider,
  walletActionProvider,
  erc20ActionProvider,
  erc721ActionProvider,
  cdpApiActionProvider,
  cdpEvmWalletActionProvider,
  pythActionProvider,
} from "@coinbase/agentkit";
import { getGeminiTools, executeGeminiFunction } from "@coinbase/agentkit-gemini";
import { GoogleGenerativeAI, GenerativeModel, ChatSession } from "@google/generative-ai";
import * as readline from "readline";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Debug: Log environment variables
console.log("🔍 Debug - Environment variables:");
console.log("CDP_API_KEY_ID:", process.env.CDP_API_KEY_ID ? "✅ Set" : "❌ Not set");
console.log("CDP_API_KEY_SECRET:", process.env.CDP_API_KEY_SECRET ? "✅ Set" : "❌ Not set");
console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "✅ Set" : "❌ Not set");

/**
 * Validates that required environment variables are set
 */
function validateEnvironment(): void {
  const requiredEnvVars = [
    "CDP_API_KEY_ID",
    "CDP_API_KEY_SECRET",
    "GEMINI_API_KEY",
    "CDP_WALLET_SECRET",
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
}

/**
 * Initializes the AgentKit with CDP credentials
 *
 * @returns The initialized AgentKit instance
 */
async function initializeAgentKit(): Promise<AgentKit> {
  // Debug: Log the actual values being passed to AgentKit
  console.log("🔍 Debug - AgentKit initialization values:");
  console.log("cdpApiKeyId:", process.env.CDP_API_KEY_ID?.substring(0, 8) + "...");
  console.log("cdpApiKeySecret:", process.env.CDP_API_KEY_SECRET?.substring(0, 8) + "...");
  console.log("cdpWalletSecret:", process.env.PRIVATE_KEY || "undefined");

  try {
    const walletProvider = await CdpSmartWalletProvider.configureWithWallet({
      apiKeyId: process.env.CDP_API_KEY_ID!.trim(),
      apiKeySecret: process.env.CDP_API_KEY_SECRET!.trim(),
      walletSecret: process.env.CDP_WALLET_SECRET || process.env.PRIVATE_KEY,
    });

    const actionProviders = [
      wethActionProvider(),
      walletActionProvider(),
      erc20ActionProvider(),
      erc721ActionProvider(),
      cdpApiActionProvider(),
      cdpEvmWalletActionProvider(),
      pythActionProvider(),
    ];

    const agentKit = await AgentKit.from({
      walletProvider,
      actionProviders,
    });

    return agentKit;
  } catch (error) {
    console.error("🔍 Debug - AgentKit initialization error:", error);
    throw error;
  }
}

/**
 * Initializes Gemini with function calling capabilities
 *
 * @param functionDeclarations - The function declarations to use with Gemini
 * @returns The initialized Gemini model and chat session
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function initializeGemini(functionDeclarations: any[]): {
  model: GenerativeModel;
  chat: ChatSession;
} {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    systemInstruction:
      "You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit. You are empowered to interact onchain using your tools. If you ever need funds, you can request them from the faucet if you are on network ID 'base-sepolia'. If not, you can provide your wallet details and request funds from the user. Before executing your first action, get the wallet details to see what network you're on. If there is a 5XX (internal) HTTP error code, ask the user to try again later. If someone asks you to do something you can't do with your currently available tools, you must say so, and encourage them to implement it themselves using the CDP SDK + Agentkit, recommend they go to docs.cdp.coinbase.com for more information. Be concise and helpful with your responses. Refrain from restating your tools' descriptions unless it is explicitly requested.",
    generationConfig: {
      temperature: 0, // Use low temperature for more deterministic function calls
      topP: 0.95,
      topK: 64,
      maxOutputTokens: 8192,
    },
  });

  // Create chat session with tools
  const chat = model.startChat({
    tools: [{ functionDeclarations }],
    history: [],
  });

  return { model, chat };
}

/**
 * Processes a user message and handles function calls
 *
 * @param agentKit - The AgentKit instance
 * @param chat - The Gemini chat session
 * @param message - The user's message
 * @returns The chatbot's response
 */
async function processMessage(
  agentKit: AgentKit,
  chat: ChatSession,
  message: string,
): Promise<string> {
  try {
    console.log("\n🤖 Processing your request...");

    // Send message to Gemini
    const result = await chat.sendMessage(message);
    const response = result.response;

    // Check if Gemini wants to call functions
    const functionCalls = response.functionCalls();

    if (functionCalls && functionCalls.length > 0) {
      console.log(`\n🔧 Executing ${functionCalls.length} function call(s)...`);

      const functionResults: Array<{
        name: string;
        response: { result?: string; error?: string };
      }> = [];

      for (const functionCall of functionCalls) {
        console.log(`   • Calling: ${functionCall.name}`);
        console.log(`   • Arguments:`, JSON.stringify(functionCall.args, null, 2));

        try {
          const result = await executeGeminiFunction(agentKit, {
            name: functionCall.name,
            args: functionCall.args,
          });

          functionResults.push({
            name: functionCall.name,
            response: { result },
          });

          console.log(`   ✅ ${functionCall.name} completed successfully`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`   ❌ ${functionCall.name} failed:`, errorMessage);
          functionResults.push({
            name: functionCall.name,
            response: { error: errorMessage },
          });
        }
      }

      // Send function results back to get final response
      const followUpResult = await chat.sendMessage([
        {
          functionResponse: functionResults[0], // Handle first result for now
        },
      ]);

      return followUpResult.response.text();
    }

    return response.text();
  } catch (error) {
    console.error("Error processing message:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Sorry, I encountered an error: ${errorMessage}`;
  }
}

/**
 * Creates a readline interface for user input
 *
 * @returns The created readline interface
 */
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Displays available commands to the user
 */
function displayHelp(): void {
  console.log(`
📋 Available Commands:
  • Transfer ETH: "Send 0.01 ETH to 0x742d35Cc6634C0532925a3b8D4C9db96590c6C8C"
  • Check balance: "What's my wallet balance?"
  • Get faucet funds: "Use the faucet to get some test ETH"
  • Token prices: "What is the price of BTC?"
  • Deploy contract: "Deploy an ERC-20 token called MyToken with symbol MTK"
  • Swap tokens: "Swap 0.1 ETH for USDC"
  • Register ENS: "Register the ENS name myname.eth"
  • Help: "help" or "?"
  • Quit: "quit" or "exit"
`);
}

/**
 * Main chatbot loop
 */
async function runChatbot(): Promise<void> {
  console.log("🚀 Initializing Gemini CDP AgentKit Chatbot...\n");

  try {
    // Validate environment
    validateEnvironment();

    // Initialize AgentKit
    console.log("📦 Initializing AgentKit...");
    const agentKit = await initializeAgentKit();

    // Get function declarations for Gemini
    const functionDeclarations = getGeminiTools(agentKit);
    console.log(`🔧 Loaded ${functionDeclarations.length} AgentKit functions`);

    // Initialize Gemini
    console.log("🧠 Initializing Gemini...");
    const { chat } = initializeGemini(functionDeclarations);

    // Create readline interface
    const rl = createReadlineInterface();

    console.log("✅ Initialization complete!\n");
    console.log("🎉 Welcome to the Gemini CDP AgentKit Chatbot!");
    console.log("💡 I can help you interact with the Web3 ecosystem using your CDP Smart Wallet.");

    displayHelp();

    // Main chat loop
    const askQuestion = (): void => {
      rl.question("\n💬 You: ", async (input: string) => {
        const trimmedInput = input.trim().toLowerCase();

        // Handle special commands
        if (trimmedInput === "quit" || trimmedInput === "exit") {
          console.log("\n👋 Goodbye! Thanks for using the Gemini CDP AgentKit Chatbot!");
          rl.close();
          return;
        }

        if (trimmedInput === "help" || trimmedInput === "?") {
          displayHelp();
          askQuestion();
          return;
        }

        if (trimmedInput === "") {
          askQuestion();
          return;
        }

        // Process the message
        const response = await processMessage(agentKit, chat, input);
        console.log(`\n🤖 Assistant: ${response}`);

        // Continue the conversation
        askQuestion();
      });
    };

    askQuestion();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Failed to initialize chatbot:", errorMessage);
    console.error("\n💡 Make sure you have:");
    console.error("   1. Renamed .env-local to .env");
    console.error("   2. Set your CDP_API_KEY_ID and CDP_API_KEY_SECRET");
    console.error("   3. Set your GEMINI_API_KEY");
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n\n👋 Goodbye! Thanks for using the Gemini CDP AgentKit Chatbot!");
  process.exit(0);
});

// Start the chatbot
if (require.main === module) {
  runChatbot().catch(error => {
    console.error("❌ Chatbot crashed:", error);
    process.exit(1);
  });
}
