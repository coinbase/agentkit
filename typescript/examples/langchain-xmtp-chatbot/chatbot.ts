import * as dotenv from "dotenv";
import * as fs from "fs";
import {
  AgentKit,
  CdpEvmWalletProvider,
  walletActionProvider,
  erc20ActionProvider,
  cdpApiActionProvider,
  cdpEvmWalletActionProvider,
  pythActionProvider,
  wethActionProvider,
  x402ActionProvider,
  NETWORK_ID_TO_VIEM_CHAIN,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { Agent as XMTPAgent, type MessageContext, type AgentMiddleware } from "@xmtp/agent-sdk";
import {
  TransactionReferenceCodec,
  ContentTypeTransactionReference,
  type TransactionReference,
} from "@xmtp/content-type-transaction-reference";
import {
  ContentTypeWalletSendCalls,
  WalletSendCallsCodec,
  type WalletSendCallsParams,
} from "@xmtp/content-type-wallet-send-calls";
import { parseEther, createPublicClient, http, formatEther, Chain } from "viem";

// Initialize environment variables
dotenv.config();

// Storage constants
const STORAGE_DIR = ".data/wallets";

// Global stores for memory and agent instances
const memoryStore: Record<string, MemorySaver> = {};
const agentStore: Record<string, Agent> = {};

// Initialize public client
const networkId = process.env.NETWORK_ID || "base-sepolia";
const chain = NETWORK_ID_TO_VIEM_CHAIN[networkId as keyof typeof NETWORK_ID_TO_VIEM_CHAIN];
const chainId = `0x${chain.id.toString(16)}` as `0x${string}`;
const publicClient = createPublicClient({
  chain: chain as Chain,
  transport: process.env.RPC_URL ? http(process.env.RPC_URL) : http(),
});

interface AgentConfig {
  configurable: {
    thread_id: string;
  };
}

interface WalletData {
  name?: string;
  address: `0x${string}`;
}

type Agent = ReturnType<typeof createReactAgent>;

/**
 * Ensure local storage directory exists
 */
function ensureLocalStorage() {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

/**
 * Save wallet data to storage.
 *
 * @param userId - The unique identifier for the user
 * @param walletData - The wallet data to be saved
 */
function saveWalletData(userId: string, walletData: WalletData): void {
  const localFilePath = `${STORAGE_DIR}/${userId}.json`;
  try {
    fs.writeFileSync(localFilePath, JSON.stringify(walletData, null, 2));
    console.log(`Wallet data saved for user ${userId}`);
  } catch (error) {
    console.error(`Failed to save wallet data to file: ${error}`);
  }
}

/**
 * Get wallet data from storage.
 *
 * @param userId - The unique identifier for the user
 * @returns The wallet data, or null if not found
 */
function getWalletData(userId: string): WalletData | null {
  const localFilePath = `${STORAGE_DIR}/${userId}.json`;
  try {
    if (fs.existsSync(localFilePath)) {
      return JSON.parse(fs.readFileSync(localFilePath, "utf8"));
    }
  } catch (error) {
    console.warn(`Could not read wallet data from file: ${error}`);
  }
  return null;
}

/**
 * Initialize the agent with CDP Agentkit.
 *
 * @param userId - The unique identifier for the user
 * @returns The initialized agent and its configuration
 */
async function initializeAgent(userId: string): Promise<{ agent: Agent; config: AgentConfig }> {
  try {
    if (agentStore[userId]) {
      console.log(`Using existing agent for user: ${userId}`);
      const agentConfig = {
        configurable: { thread_id: userId },
      };
      return { agent: agentStore[userId], config: agentConfig };
    }

    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
    });

    const storedWalletData = getWalletData(userId);

    console.log(
      `Creating new agent for user: ${userId}, wallet data: ${storedWalletData ? "Found" : "Not found"}`,
    );

    // Configure CDP Wallet Provider with CDP v2
    const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
      apiKeyId: process.env.CDP_API_KEY_ID,
      apiKeySecret: process.env.CDP_API_KEY_SECRET,
      walletSecret: process.env.CDP_WALLET_SECRET,
      idempotencyKey: process.env.IDEMPOTENCY_KEY,
      address: storedWalletData?.address, // Retrieve existing wallet if available
      networkId: process.env.NETWORK_ID || "base-sepolia",
      rpcUrl: process.env.RPC_URL,
    });

    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        walletActionProvider(),
        erc20ActionProvider(),
        wethActionProvider(),
        cdpApiActionProvider(),
        cdpEvmWalletActionProvider(),
        pythActionProvider(),
        x402ActionProvider(),
      ],
    });

    const tools = await getLangChainTools(agentkit);

    if (!memoryStore[userId]) {
      console.log(`Creating new memory store for user: ${userId}`);
      memoryStore[userId] = new MemorySaver();
    }

    const agentConfig: AgentConfig = {
      configurable: { thread_id: userId },
    };

    const canUseFaucet = walletProvider.getNetwork().networkId == "base-sepolia";
    const faucetMessage = `If you ever need funds, you can request them from the faucet.`;
    const cantUseFaucetMessage = `If you need funds, you can request funds from the user. Advise the user to use the "/fund <amountInETH>" command to send ETH to your wallet.`;
    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memoryStore[userId],
      messageModifier: `
        You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit. You are 
        empowered to interact onchain using your tools. 
        Before executing your first action, get the wallet details to see your address and what network you're on. 
        ${canUseFaucet ? faucetMessage : cantUseFaucetMessage}.
        If someone asks you to do something you can't do with your currently available tools, you must say so, and 
        encourage them to implement it themselves using the CDP SDK + Agentkit, recommend they go to 
        docs.cdp.coinbase.com for more information. Be concise and helpful with your responses. Refrain from 
        restating your tools' descriptions unless it is explicitly requested.
      `,
    });

    agentStore[userId] = agent;

    const exportedWallet = await walletProvider.exportWallet();
    saveWalletData(userId, exportedWallet);

    return { agent, config: agentConfig };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
}

/**
 * Process a message with the agent.
 *
 * @param agent - The agent instance to process the message
 * @param config - The agent configuration
 * @param message - The message to process
 * @returns The processed response as a string
 */
async function processMessage(agent: Agent, config: AgentConfig, message: string): Promise<string> {
  let response = "";

  try {
    const stream = await agent.stream({ messages: [new HumanMessage(message)] }, config);

    for await (const chunk of stream) {
      if ("agent" in chunk) {
        response += chunk.agent.messages[0].content + "\n";
      }
    }

    return response.trim();
  } catch (error) {
    console.error("Error processing message:", error);
    return "Sorry, I encountered an error while processing your request. Please try again later.";
  }
}

/**
 * Handle incoming XMTP messages.
 *
 * @param ctx - The message context from XMTP agent SDK
 */
async function handleMessage(ctx: MessageContext) {
  try {
    const userId = ctx.message.senderInboxId;
    console.log(`Received message from ${userId}: ${ctx.message.content}`);

    const { agent, config } = await initializeAgent(userId);
    const response = await processMessage(agent, config, String(ctx.message.content));

    await ctx.sendText(response);
    console.log(`Sent response to ${userId}: ${response}`);
  } catch (error) {
    console.error("Error handling message:", error);
    await ctx.sendText(
      "I encountered an error while processing your request. Please try again later.",
    );
  }
}

/**
 * Transaction reference middleware to handle confirmed transactions
 *
 * @param ctx - The message context from XMTP agent SDK
 * @param next - The next middleware function in the chain
 */
const transactionReferenceMiddleware: AgentMiddleware = async (ctx, next) => {
  // Check if this is a transaction reference message
  if (ctx.message.contentType?.sameAs(ContentTypeTransactionReference)) {
    const transactionRef = ctx.message.content as TransactionReference;

    await ctx.sendText(
      `✅ Transaction confirmed!\n` +
        `🔗 Network: ${transactionRef.networkId}\n` +
        `📄 Hash: ${transactionRef.reference}\n` +
        `${transactionRef.metadata ? `📝 Transaction metadata received` : ""}`,
    );

    // Don't continue to other handlers since we handled this message
    return;
  }

  // Continue to next middleware/handler
  await next();
};

/**
 * Validates that required environment variables are set.
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];

  const requiredVars = [
    "OPENAI_API_KEY",
    "CDP_API_KEY_ID",
    "CDP_API_KEY_SECRET",
    "CDP_WALLET_SECRET",
    "XMTP_WALLET_KEY",
    "XMTP_DB_ENCRYPTION_KEY",
  ];

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

  if (!process.env.NETWORK_ID) {
    console.warn("Warning: NETWORK_ID not set, defaulting to base-sepolia");
  }

  if (!process.env.XMTP_ENV) {
    console.warn("Warning: XMTP_ENV not set, defaulting to dev");
  }
}

/**
 * Main function to start the chatbot.
 */
async function main(): Promise<void> {
  console.log("Initializing Agent on XMTP...");

  validateEnvironment();
  ensureLocalStorage();

  // Create XMTP agent using environment variables with transaction codecs
  const xmtpAgent = await XMTPAgent.createFromEnv({
    env: (process.env.XMTP_ENV as "local" | "dev" | "production") || "dev",
    codecs: [new WalletSendCallsCodec(), new TransactionReferenceCodec()],
  });

  // Apply the transaction reference middleware
  xmtpAgent.use(transactionReferenceMiddleware);

  // Handle /fund command - triggers an ETH transaction from user wallet to agent wallet
  xmtpAgent.on("text", async ctx => {
    const message = ctx.message.content as string;
    if (!message.startsWith("/fund")) {
      handleMessage(ctx);
      return;
    }

    const agentAddress = xmtpAgent.address;
    if (!agentAddress) {
      await ctx.sendText("Agent address not found");
      return;
    }
    const senderAddress = await ctx.getSenderAddress();

    const parts = message.split(" ");
    if (parts.length < 2) {
      await ctx.sendText("Please provide an ETH amount. Usage: /fund <amountInETH>");
      return;
    }

    const amount = parseFloat(parts[1]);
    if (isNaN(amount) || amount <= 0) {
      await ctx.sendText("Please provide a valid ETH amount. Usage: /fund <amountInETH>");
      return;
    }

    // Convert amount to wei
    const amountInWei = parseEther(amount.toString());

    // Check user's balance
    const balance = await publicClient.getBalance({
      address: senderAddress as `0x${string}`,
    });

    if (balance < amountInWei) {
      await ctx.sendText(
        `❌ Insufficient balance. You have ${formatEther(balance)} ETH but trying to send ${amount} ETH.`,
      );
      return;
    }

    const walletSendCalls: WalletSendCallsParams = {
      version: "1.0",
      from: senderAddress as `0x${string}`,
      chainId: chainId,
      calls: [
        {
          to: agentAddress as `0x${string}`,
          value: `0x${amountInWei.toString(16)}`,
          metadata: {
            description: `Send ${amount} ETH to the agent's wallet ${agentAddress}`,
            transactionType: "transfer",
            currency: "ETH",
            amount: amountInWei.toString(),
            decimals: "18",
            toAddress: agentAddress,
          },
        },
      ],
    };

    // Send transaction request to user
    await ctx.conversation.send(walletSendCalls, ContentTypeWalletSendCalls);

    // Send a follow-up message about transaction references
    await ctx.sendText(
      `💡 Please sign the transaction in your wallet to send ${amount} ETH to the agent's wallet ${agentAddress}.`,
    );
  });

  // Log when agent starts
  xmtpAgent.on("start", () => {
    const env = process.env.XMTP_ENV || "dev";
    console.log(`Agent initialized on ${env} network`);
    console.log(`Agent address: ${xmtpAgent.address}`);
    console.log(`Send a message on http://xmtp.chat/dm/${xmtpAgent.address}?env=${env}`);
    console.log(`Listening for messages...`);
  });

  // Handle errors
  xmtpAgent.on("unhandledError", error => {
    console.error("Unhandled error:", error);
  });

  await xmtpAgent.start();
}

// Start the chatbot
main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
