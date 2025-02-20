import { AgentRequest, AgentResponse } from "@/app/types/api";
import { AgentKit, erc20ActionProvider, jupiterActionProvider, PrivyWalletProvider, pythActionProvider, splActionProvider, walletActionProvider, wethActionProvider } from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { NextResponse } from "next/server";

let agent: ReturnType<typeof createReactAgent>;

async function initializeAgent(): Promise<ReturnType<typeof createReactAgent>> {
  if (agent) {
    return agent;
  }

  try {
    // Initialize LLM
    const llm = new ChatOpenAI({ model: "gpt-4o-mini" });

    // Initialize WalletProvider
    const walletProvider = await PrivyWalletProvider.configureWithWallet({
      appId: process.env.PRIVY_APP_ID as string,
      appSecret: process.env.PRIVY_APP_SECRET as string,
      walletId: process.env.PRIVY_WALLET_ID as string,
      authorizationPrivateKey: process.env.PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY,
      authorizationKeyId: process.env.PRIVY_WALLET_AUTHORIZATION_KEY_ID,
      chainType: "solana",
      networkId: process.env.NETWORK_ID,
    });
    
    // Initialize AgentKit
    const agentkit = await AgentKit.from({
        walletProvider,
        actionProviders: [
          walletActionProvider(),
          splActionProvider(),
          jupiterActionProvider()
        ],
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
