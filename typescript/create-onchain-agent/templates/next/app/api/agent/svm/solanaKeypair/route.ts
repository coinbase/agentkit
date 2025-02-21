import { AgentRequest, AgentResponse } from "@/app/types/api";
import {
  AgentKit,
  SOLANA_NETWORK_ID,
  SolanaKeypairWalletProvider,
  splActionProvider,
  walletActionProvider,
  jupiterActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { NextResponse } from "next/server";

/**
 * AgentKit Integration Route
 *
 * This file is your gateway to integrating AgentKit with your product.
 * It defines the interaction between your system and the AI agent,
 * allowing you to configure the agent to suit your needs.
 *
 * # Key Steps to Customize Your Agent:**
 *
 * 1. Select your LLM:
 *    - Modify the `ChatOpenAI` instantiation to choose your preferred LLM.
 *
 * 2. Set up your WalletProvider:
 *    - Learn more: https://github.com/coinbase/agentkit/tree/main/typescript/agentkit#evm-wallet-providers
 *
 * 3️. Set up your ActionProviders:
 *    - ActionProviders define what your agent can do.
 *    - Choose from built-in providers or create your own:
 *      - Built-in: https://github.com/coinbase/agentkit/tree/main/typescript/agentkit#action-providers
 *      - Custom: https://github.com/coinbase/agentkit/tree/main/typescript/agentkit#creating-an-action-provider
 *
 * 4. Instantiate your Agent:
 *    - Pass the LLM, tools, and memory into `createReactAgent()` to bring your agent to life.
 *
 * # Next Steps:
 * - Explore the AgentKit README: https://github.com/coinbase/agentkit
 * - Learn more about available WalletProviders & ActionProviders.
 * - Experiment with custom ActionProviders for your unique use case.
 *
 * ## Want to contribute?
 * Join us in shaping AgentKit! Check out the contribution guide:
 * - https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING.md
 * - https://discord.gg/CDP
 */

// The agent
let agent: ReturnType<typeof createReactAgent>;

/**
 * Initializes and returns an instance of the AI agent.
 * If an agent instance already exists, it returns the existing one.
 *
 * @function getOrInitializeAgent
 * @returns {Promise<ReturnType<typeof createReactAgent>>} The initialized AI agent.
 *
 * @description Handles agent setup
 *
 * @throws {Error} If the agent initialization fails.
 */
async function getOrInitializeAgent(): Promise<ReturnType<typeof createReactAgent>> {
  // If agent has already been initialized, return it
  if (agent) {
    return agent;
  }

  try {
    // Initialize LLM: https://platform.openai.com/docs/models#gpt-4o
    const llm = new ChatOpenAI({ model: "gpt-4o-mini" });

    // Setup Private Key
    let solanaPrivateKey = process.env.SOLANA_PRIVATE_KEY as string;
    if (!solanaPrivateKey) {
      console.log(`No Solana account detected. Generating a wallet...`);
      const keypair = Keypair.generate();
      solanaPrivateKey = bs58.encode(keypair.secretKey);
      console.log(`Created Solana wallet: ${keypair.publicKey.toBase58()}`);
      console.log(`Store the private key in your .env for future reuse: ${solanaPrivateKey}`);
    }

    // Initialize WalletProvider: https://docs.cdp.coinbase.com/agentkit/docs/wallet-management
    // Configure Solana Keypair Wallet Provider
    const rpcUrl = process.env.SOLANA_RPC_URL;
    let walletProvider: SolanaKeypairWalletProvider;
    if (rpcUrl) {
      walletProvider = await SolanaKeypairWalletProvider.fromRpcUrl(rpcUrl, solanaPrivateKey);
    } else {
      const network = (process.env.NETWORK_ID ?? "solana-devnet") as SOLANA_NETWORK_ID;
      walletProvider = await SolanaKeypairWalletProvider.fromNetwork(network, solanaPrivateKey);
    }

    // Initialize AgentKit: https://docs.cdp.coinbase.com/agentkit/docs/agent-actions
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [splActionProvider(), walletActionProvider(), jupiterActionProvider()],
    });
    const tools = await getLangChainTools(agentkit);
    const memory = new MemorySaver();

    // Initialize Agent
    agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
    });

    return agent;
  } catch (error) {
    console.error("Error initializing agent:", error);
    throw new Error("Failed to initialize agent");
  }
}

/**
 * Handles incoming POST requests to interact with the AgentKit-powered AI agent.
 * This function processes user messages and streams responses from the agent.
 *
 * @function POST
 * @param {Request & { json: () => Promise<AgentRequest> }} req - The incoming request object containing the user message.
 * @returns {Promise<NextResponse<AgentResponse>>} JSON response containing the AI-generated reply or an error message.
 *
 * @description Sends a single message to the agent and returns the agents' final response.
 *
 * @example
 * const response = await fetch("/api/agent", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify({ userMessage: input }),
 * });
 */
export async function POST(
  req: Request & { json: () => Promise<AgentRequest> },
): Promise<NextResponse<AgentResponse>> {
  try {
    // 1️. Extract user message from the request body
    const { userMessage } = await req.json();

    // 2. Get the agent
    const agent = await getOrInitializeAgent();

    // 3.Start streaming the agent's response
    const stream = await agent.stream(
      { messages: [{ content: userMessage, role: "user" }] }, // The new message to send to the agent
      { configurable: { thread_id: "AgentKit Discussion" } }, // Customizable thread ID for tracking conversations
    );

    // 4️. Process the streamed response chunks into a single message
    let agentResponse = "";
    for await (const chunk of stream) {
      if ("agent" in chunk) {
        agentResponse += chunk.agent.messages[0].content;
      }
    }

    // 5️. Return the final response
    return NextResponse.json({ response: agentResponse });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json({ error: "Failed to process message" });
  }
}
