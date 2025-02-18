import { NextResponse } from "next/server";
import { AgentKit, cdpApiActionProvider, cdpWalletActionProvider, CdpWalletProvider, erc20ActionProvider, pythActionProvider, walletActionProvider, wethActionProvider } from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { AgentRequest, AgentResponse } from "@/app/types/api";

let agent: ReturnType<typeof createReactAgent>;

async function initializeAgent(): Promise<ReturnType<typeof createReactAgent>> {
  if (agent) {
    return agent;
  }

  try {
    // Initialize LLM
    const llm = new ChatOpenAI({ model: "gpt-4o-mini" });

    // Initialize WalletProvider
    const walletProvider = await CdpWalletProvider.configureWithWallet({
      apiKeyName: process.env.CDP_API_KEY_NAME,
      apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      networkId: process.env.NETWORK_ID || "base-sepolia",
    });
    
    // Initialize AgentKit
    const agentkit = await AgentKit.from({
        walletProvider,
        actionProviders: [
            wethActionProvider(),
            pythActionProvider(),
            walletActionProvider(),
            erc20ActionProvider(),
            cdpApiActionProvider({
            apiKeyName: process.env.CDP_API_KEY_NAME,
            apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
            }),
            cdpWalletActionProvider({
            apiKeyName: process.env.CDP_API_KEY_NAME,
            apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
            }),
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
