import {
  AgentKit,
  CdpEvmWalletProvider,
  dtelecomActionProvider,
  erc20ActionProvider,
  walletActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { VoiceAgent, LLMPlugin, LLMChunk, Message } from "@dtelecom/agents-js";
import { DtelecomSTT, DtelecomTTS } from "@dtelecom/agents-js/providers";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { exec } from "node:child_process";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Custom LLM adapter that bridges dTelecom VoiceAgent with a LangChain ReAct agent.
 *
 * STT transcription flows in as messages, the ReAct agent reasons about which
 * on-chain tools to call, and only the final text response is streamed back
 * to TTS for speech synthesis.
 */
class AgentKitLLM implements LLMPlugin {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private agent: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private config: Record<string, any>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(agent: any, config: Record<string, any>) {
    this.agent = agent;
    this.config = config;
  }

  async *chat(messages: Message[], signal?: AbortSignal): AsyncGenerator<LLMChunk> {
    const lastUserMsg = messages.filter((m) => m.role === "user").pop();
    if (!lastUserMsg) {
      yield { type: "done" };
      return;
    }

    const stream = await this.agent.stream(
      { messages: [new HumanMessage(lastUserMsg.content)] },
      { ...this.config, signal },
    );

    for await (const chunk of stream) {
      if ("model_request" in chunk) {
        const content = chunk.model_request.messages[0]?.content;
        if (typeof content === "string" && content) {
          yield { type: "token", token: content };
        }
      }
    }

    yield { type: "done" };
  }
}

async function main() {
  // ── 1. CDP Wallet (same as all AgentKit examples) ───────────────────
  const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
    apiKeyId: process.env.CDP_API_KEY_ID!,
    apiKeySecret: process.env.CDP_API_KEY_SECRET!,
    walletSecret: process.env.CDP_WALLET_SECRET!,
    networkId: process.env.NETWORK_ID || "base-mainnet",
    address: process.env.ADDRESS as `0x${string}` | undefined,
  });

  console.log(`Wallet address: ${walletProvider.getAddress()}`);

  // ── 2. AgentKit with on-chain + dTelecom providers ──────────────────
  const agentkit = await AgentKit.from({
    walletProvider,
    actionProviders: [
      dtelecomActionProvider(),
      erc20ActionProvider(),
      walletActionProvider(),
    ],
  });

  // ── 3. LangChain ReAct agent with on-chain tools ─────────────────────
  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY!,
  });
  const tools = await getLangChainTools(agentkit);
  const memory = new MemorySaver();
  const agentConfig = { configurable: { thread_id: "dtelecom-voice-agent" } };

  const agent = createAgent({
    model: llm,
    tools,
    checkpointer: memory,
    systemPrompt:
      "You are a voice assistant that can interact onchain using Coinbase AgentKit. " +
      "You can check balances, send tokens, and manage dTelecom voice sessions. " +
      "Keep responses short and conversational since they will be spoken aloud. " +
      "If you need funds, you can request them from the faucet on testnet.",
  });

  // ── 4. Ensure dTelecom credits (programmatic) ────────────────────────
  const actions = agentkit.getActions();
  const invoke = async (name: string, args: Record<string, unknown> = {}) => {
    const action = actions.find((a) => a.name === name);
    if (!action) throw new Error(`Action ${name} not found`);
    const result = await action.invoke(args);
    if (result.startsWith("Error")) throw new Error(result);
    return JSON.parse(result);
  };

  try {
    const acct = await invoke("DtelecomActionProvider_get_account");
    console.log(`Credit balance: ${acct.availableBalance} microcredits`);
    if (BigInt(acct.availableBalance) < 200_000n) {
      console.log("Low balance — buying $0.10 of credits...");
      try {
        await invoke("DtelecomActionProvider_buy_credits", { amountUsd: 0.1 });
      } catch (e) {
        console.log("Could not buy credits (wallet may need USDC). Continuing with existing balance...");
      }
    }
  } catch {
    console.log("Creating account with $0.10 of credits...");
    await invoke("DtelecomActionProvider_buy_credits", { amountUsd: 0.1 });
  }

  // ── 5. Create voice session via AgentKit action ─────────────────────
  console.log("Creating voice session...");
  const session = await invoke("DtelecomActionProvider_create_agent_session", {
    roomName: `voice-demo-${Date.now()}`,
    participantIdentity: "agent",
    clientIdentity: "user",
    durationMinutes: 1,
    ttsMaxCharacters: 500,
    language: "a", // English US
  });

  console.log(`Session created: bundle=${session.bundleId}`);

  // ── 6. Start voice agent with AgentKit LLM adapter ──────────────────
  const voiceAgent = new VoiceAgent({
    stt: new DtelecomSTT({
      serverUrl: session.stt.serverUrl,
      sessionKey: session.stt.token,
    }),
    llm: new AgentKitLLM(agent, agentConfig),
    tts: new DtelecomTTS({
      serverUrl: session.tts.serverUrl,
      sessionKey: session.tts.token,
      voices: { en: { voice: "af_heart", langCode: "a" } },
    }),
    instructions:
      "You are a voice assistant that can interact onchain using Coinbase AgentKit. " +
      "Keep responses short and conversational.",
  });

  await voiceAgent.start({
    token: session.webrtc.agent.token,
    wsUrl: session.webrtc.agent.wsUrl,
    identity: "voice-agent",
    name: "AI Voice Agent",
  });

  voiceAgent.say(
    "Hello! I'm your AI voice assistant powered by Coinbase AgentKit and dTelecom. " +
      "You can ask me to check your wallet balance, send tokens, or manage voice sessions. " +
      "How can I help you today?",
  );

  // ── 7. Serve client page on localhost:3000 ──────────────────────────
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const clientHtml = readFileSync(resolve(__dirname, "client.html"), "utf-8");
  const html = clientHtml
    .replace("__TOKEN__", session.webrtc.client.token)
    .replace("__WS_URL__", session.webrtc.client.wsUrl);

  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  }).listen(3000);

  console.log("\nOpening http://localhost:3000 in your browser...");
  console.log("Press Ctrl+C to stop.\n");
  exec("open http://localhost:3000");

  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await voiceAgent.stop();
    server.close();
    process.exit(0);
  });
}

main().catch(console.error);
