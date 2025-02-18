import { AgentRequest, AgentResponse } from "@/app/types/api";
import { AgentKit, SOLANA_NETWORK_ID, SolanaKeypairWalletProvider, splActionProvider, walletActionProvider } from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { NextResponse } from "next/server";

let agent: ReturnType<typeof createReactAgent>;

async function initializeAgent(): Promise<ReturnType<typeof createReactAgent>> {
  if (agent) {
    return agent;
  }

  try {
    // Initialize LLM
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

    // Initialize WalletProvider
    // Configure Solana Keypair Wallet Provider
    const rpcUrl = process.env.SOLANA_RPC_URL;
    let walletProvider: SolanaKeypairWalletProvider;
    if (rpcUrl) {
      walletProvider = await SolanaKeypairWalletProvider.fromRpcUrl(rpcUrl, solanaPrivateKey);
    } else {
      const network = (process.env.NETWORK_ID ?? "solana-devnet") as SOLANA_NETWORK_ID;
      walletProvider = await SolanaKeypairWalletProvider.fromNetwork(network, solanaPrivateKey);
    }
    
    // Initialize AgentKit
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [splActionProvider(), walletActionProvider()],
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

export async function POST(req: Request & { json: () => Promise<AgentRequest> }): Promise<NextResponse<AgentResponse>> {
  try {
    const { userMessage } = await req.json();
    const agent = await initializeAgent();

    const stream = await agent.stream({ messages: [{ content: userMessage, role: "user" }] }, {configurable: {thread_id: 'AgentKit Discussion'}});

    let responseMessage = "";
    for await (const chunk of stream) {
      if ("agent" in chunk) {
        responseMessage += chunk.agent.messages[0].content;
      }
    }

    return NextResponse.json({ response: responseMessage });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json({ error: "Failed to process message" }, { status: 500 });
  }
}
