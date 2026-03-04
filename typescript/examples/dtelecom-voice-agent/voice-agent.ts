import {
  AgentKit,
  CdpEvmWalletProvider,
  dtelecomActionProvider,
} from "@coinbase/agentkit";
import { VoiceAgent } from "@dtelecom/agents-js";
import { DtelecomSTT, DtelecomTTS, OpenAILLM } from "@dtelecom/agents-js/providers";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { exec } from "node:child_process";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env-local" });

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

  // ── 2. AgentKit with dTelecom provider ──────────────────────────────
  const agentkit = await AgentKit.from({
    walletProvider,
    actionProviders: [dtelecomActionProvider()],
  });

  // ── 3. Ensure credits (programmatic action invocation) ──────────────
  const actions = agentkit.getActions();
  const invoke = async (name: string, args: Record<string, unknown> = {}) => {
    const action = actions.find((a) => a.name === name);
    if (!action) throw new Error(`Action ${name} not found`);
    return JSON.parse(await action.invoke(args));
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

  // ── 4. Create voice session via AgentKit action ─────────────────────
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

  // ── 5. Start voice agent (server-side) ──────────────────────────────
  const voiceAgent = new VoiceAgent({
    stt: new DtelecomSTT({
      serverUrl: session.stt.serverUrl,
      sessionKey: session.stt.token,
    }),
    llm: new OpenAILLM({
      apiKey: process.env.OPENAI_API_KEY!,
      model: "gpt-4o-mini",
    }),
    tts: new DtelecomTTS({
      serverUrl: session.tts.serverUrl,
      sessionKey: session.tts.token,
      voices: { en: { voice: "af_heart", langCode: "a" } },
    }),
    instructions:
      "You are a helpful voice assistant. Keep responses short and conversational.",
  });

  await voiceAgent.start({
    token: session.webrtc.agent.token,
    wsUrl: session.webrtc.agent.wsUrl,
    identity: "voice-agent",
    name: "AI Voice Agent",
  });

  voiceAgent.say(
    "Hello! I'm your AI voice assistant powered by Coinbase AgentKit and dTelecom. How can I help you today?",
  );

  // ── 6. Serve client page on localhost:3000 ──────────────────────────
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const clientHtml = readFileSync(resolve(__dirname, "client.html"), "utf-8");
  const html = clientHtml
    .replace("__TOKEN__", session.webrtc.client.token)
    .replace("__WS_URL__", session.webrtc.client.wsUrl);

  const server = createServer((req, res) => {
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
