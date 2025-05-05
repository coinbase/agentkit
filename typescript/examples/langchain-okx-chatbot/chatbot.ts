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

    // Dynamically import and decode the base58 private key
    const bs58 = (await import("bs58")).default;
    const decodedPrivateKey = bs58.decode(privateKey);
    const walletProvider = await SolanaKeypairWalletProvider.fromNetwork(network, decodedPrivateKey);

    // Get the public key from the private key using @solana/web3.js
    const keypair = Keypair.fromSecretKey(decodedPrivateKey);
    const userWalletAddress = keypair.publicKey.toString();

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

        // Set the wallet provider for the OKX provider
        (okxProvider as any).walletProvider = walletProvider;
        console.log("Wallet provider assigned to OKX DEX provider");

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
    const agentConfig = {
      configurable: {
        thread_id: "Solana AgentKit Chatbot with OKX DEX!",
        userWalletAddress: userWalletAddress // Add the wallet address to the config
      }
    };

    // Create React Agent using the LLM and Solana AgentKit tools
    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: `
        You are a helpful agent that can interact onchain on Solana using the Coinbase Developer Platform AgentKit.
        
        You have access to OKX DEX operations on Solana, which allows you to:
        1. Get swap quotes for tokens on the Solana network (get_swap_quote)
        2. Execute token swaps directly on the blockchain (swap_tokens)
        3. Broadcast signed transactions to the network (broadcast_transaction)
        
        Common Solana token addresses and decimals:
        - SOL (Native): 11111111111111111111111111111111 (9 decimals)
        - USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v (6 decimals)
        - USDT: Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB (6 decimals)
        - BONK: DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263 (5 decimals)
        - JUP: JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN (6 decimals)
        - ORCA: orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE (6 decimals)

        When using get_swap_quote action:
        - Required: fromTokenAddress, toTokenAddress, amount
        - Amount must be in raw units (e.g., 1 SOL = 1000000000 lamports)
        - Optional: slippage (default "0.5"), directRoute (true/false)
        
        When using swap_tokens action:
        - Required: fromTokenAddress, toTokenAddress, amount, slippage
        - Amount must be in raw units (e.g., 1 SOL = 1000000000 lamports)
        - The userWalletAddress will be automatically set to ${userWalletAddress}
        - Optional: swapReceiverAddress, computeUnitPrice, computeUnitLimit
        
        Token amounts should be in the smallest units (lamports):
        - 1 SOL = 1,000,000,000 lamports (9 decimals)
        - 1 USDC = 1,000,000 units (6 decimals)
        - 1 USDT = 1,000,000 units (6 decimals)
        - 1 BONK = 100,000 units (5 decimals)
        - 1 JUP = 1,000,000 units (6 decimals)
        - 1 ORCA = 1,000,000 units (6 decimals)
        
        Always confirm with the user before executing an actual swap.
        First get a quote, show the details to the user, and only if they confirm, proceed with the swap.
        
        For swap quotes, present the information in a user-friendly format:
        - Exchange rate (e.g., "1 SOL = 30.5 USDC")
        - Expected output amount in human-readable format
        - Estimated gas fee in SOL and USD
        - Price impact if available

        For swap transaction success messages only use links built from: https://web3.okx.com/explorer/solana/tx/

        If Error processing transaction: Signature {txSignature} has expired: block height exceeded.
        Then make a message that this may just be a rpc issue and to check a link made with {txSignature}
        
        Be concise and helpful with your responses.
        `,
    });

    return { agent, config: agentConfig };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error; // Re-throw to be handled by caller
  }
}

/**
 * Format token amount for display based on token symbol
 * 
 * @param amount - Raw amount in smallest units
 * @param tokenSymbol - Token symbol (SOL, USDC, etc.)
 * @returns Formatted amount as string
 */
function formatTokenAmount(amount: string, tokenSymbol: string): string {
  const amountNum = Number(amount);
  let decimals = 9; // Default for SOL

  // Set decimals based on token
  switch (tokenSymbol.toUpperCase()) {
    case 'SOL':
      decimals = 9;
      break;
    case 'USDC':
    case 'USDT':
      decimals = 6;
      break;
    default:
      decimals = 9; // Default
  }

  const formattedAmount = (amountNum / Math.pow(10, decimals)).toFixed(decimals);
  return `${formattedAmount} ${tokenSymbol}`;
}

/**
 * Parse and format OKX DEX swap quote for display
 * 
 * @param quoteData - Raw quote data from OKX DEX
 * @returns Formatted quote string
 */
function formatSwapQuote(quoteData: any): string {
  try {
    // Check for error responses
    if (quoteData.code !== "0") {
      return `Error from OKX API: [${quoteData.code}] ${quoteData.msg}`;
    }

    if (!quoteData.data || quoteData.data.length === 0) {
      return "No quote data available in the response";
    }

    const swapData = quoteData.data[0];
    const routerResult = swapData.routerResult || swapData;

    // Get token information
    const fromToken = routerResult.fromToken || {
      tokenSymbol: "SOL",
      decimal: "9",
      tokenUnitPrice: "0"
    };
    const toToken = routerResult.toToken || {
      tokenSymbol: "USDC",
      decimal: "6",
      tokenUnitPrice: "0"
    };
    const fromDecimals = parseInt(fromToken.decimal || "9");
    const toDecimals = parseInt(toToken.decimal || "6");

    // Calculate amounts
    const inputAmount = parseFloat(routerResult.fromTokenAmount || "0") / Math.pow(10, fromDecimals);
    const outputAmount = parseFloat(routerResult.toTokenAmount || "0") / Math.pow(10, toDecimals);

    // Calculate USD values if prices are available
    const fromTokenPrice = parseFloat(fromToken.tokenUnitPrice || "0");
    const toTokenPrice = parseFloat(toToken.tokenUnitPrice || "0");
    const inputUsd = (inputAmount * fromTokenPrice).toFixed(2);
    const outputUsd = (outputAmount * toTokenPrice).toFixed(2);

    // Format gas fee
    const gasFeeLamports = routerResult.estimateGasFee || "0";
    const gasFeeSol = (Number(gasFeeLamports) / 1e9).toFixed(9);
    const gasFeeUsd = (Number(gasFeeSol) * fromTokenPrice).toFixed(2);

    // Build the quote display
    let quote = "\nSwap Quote:\n";
    quote += `Input: ${inputAmount.toFixed(fromDecimals)} ${fromToken.tokenSymbol} ($${inputUsd})\n`;
    quote += `Output: ${outputAmount.toFixed(toDecimals)} ${toToken.tokenSymbol} ($${outputUsd})\n`;

    // Add price impact if available
    if (routerResult.priceImpactPercentage) {
      quote += `Price Impact: ${routerResult.priceImpactPercentage}%\n`;
    }

    // Add gas fee
    quote += `Estimated Fee: ${gasFeeSol} SOL ($${gasFeeUsd})\n`;

    // Add slippage
    const slippage = parseFloat(swapData.tx?.slippage || "0.5");
    quote += `Slippage: ${slippage}`;

    // // Add minimum received amount (optional)
    // const minAmount = outputAmount * (1 - slippage / 100);
    // quote += `Minimum Received: ${minAmount.toFixed(toDecimals)} ${toToken.tokenSymbol}`;

    return quote;
  } catch (error) {
    console.error("Error formatting swap quote:", error);
    return "Error formatting swap quote data";
  }
}

/**
 * Run the agent interactively based on user input
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 */
async function runChatMode(agent: any, config: any) {
  console.log("Starting chat mode... Type 'exit' to end.");
  console.log("-------------------");
  console.log("Welcome to the Solana AgentKit Chatbot with OKX DEX support!");
  console.log("You can ask me to perform various operations on the Solana network.");
  console.log("Examples:");
  console.log("- 'Get a swap quote for SOL to USDC for 0.1 SOL'");
  console.log("- 'Swap 0.01 SOL to USDC with 0.5% slippage'");
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

      // Reset swap parameters if this is a new conversation or explicitly requesting a new quote
      if (userInput.toLowerCase().includes("new quote") ||
        userInput.toLowerCase().includes("another quote") ||
        userInput.toLowerCase().includes("different token")) {
      }

      const stream = await agent.stream({ messages: [new HumanMessage(userInput)] }, config);

      for await (const chunk of stream) {
        if ("agent" in chunk) {
          console.log(chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
          const content = chunk.tools.messages[0].content;

          // Check if content contains OKX DEX quote data for better formatting
          if (content.includes("Successfully fetched OKX DEX swap quote")) {
            try {
              // Extract and parse JSON data
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const quoteData = JSON.parse(jsonMatch[0]);

                // Handle API errors
                if (quoteData.code === "50050") {
                  console.log("⚠️ OKX API Service Unavailable Error: The OKX DEX API service is currently unavailable. Please try again later.");
                  continue;
                }
              } else {
                console.log(content);
              }
            } catch (e) {
              console.log("Error parsing quote data:", e);
              console.log(content);
            }
          } else if (content.includes("Successfully executed swap")) {
            const txMatch = content.match(/Transaction signature: ([A-Za-z0-9]+)/);
            if (txMatch && txMatch[1]) {
              const txSignature = txMatch[1];
              const okxExplorerUrl = `https://web3.okx.com/explorer/solana/tx/${txSignature}`;
              console.log("✅ Swap executed successfully!");
              console.log(`🔍 Track transaction: ${okxExplorerUrl}`);
            } else {
              console.log("✅ Swap executed successfully!");
            }
          } else {
            console.log(content);
          }
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
 * Run the agent autonomously with specified intervals
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 * @param interval - Time interval between actions in seconds
 */
async function runAutonomousMode(agent: any, config: any, interval = 10) {
  console.log("Starting autonomous mode...");
  console.log("Will get swap quote for 100 SOL to USDC with 0.5% slippage");
  console.log(`Using wallet address: ${config.configurable.userWalletAddress}`);

  try {
    // First get a quote with specific slippage
    const quoteThought = `Get a swap quote for 100 SOL to USDC with 0.5% slippage for wallet ${config.configurable.userWalletAddress}. Use slippage parameter of 0.5.`;
    const quoteStream = await agent.stream({ messages: [new HumanMessage(quoteThought)] }, config);

    let quoteData;
    for await (const chunk of quoteStream) {
      if ("tools" in chunk) {
        const content = chunk.tools.messages[0].content;
        if (content.includes("Successfully fetched OKX DEX swap quote")) {
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              quoteData = JSON.parse(jsonMatch[0]);
              console.log(formatSwapQuote(quoteData));
            }
          } catch (e) {
            console.error("Error parsing quote:", e);
            return;
          }
        }
      }
    }

    if (!quoteData || quoteData.code !== "0") {
      console.error("Failed to get valid quote");
      return;
    }

  } catch (error) {
    console.error("Error in autonomous mode:", error);
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