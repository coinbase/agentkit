/**
 * MainStreet Trust-Gate Chatbot — AgentKit example.
 *
 * Demonstrates a buyer agent that REFUSES to pay any wallet scoring below
 * a configurable MainStreet threshold. The reputation lookup is free; the
 * payment only happens when score >= MIN_SCORE.
 *
 * Pattern:
 *   user → "send 1 USDC to 0xAbc..."
 *   ↓
 *   tool: mainstreet_score_check → fetch + verify EIP-712 attestation
 *   ↓ (score >= MIN_SCORE)
 *   tool: native CDP transfer
 *
 * MainStreet docs: https://avisradar.app/oracle.html
 * Deployed verifier on Base: 0x7397adb9713934c36d22aa54b4dbbcd70263592b
 */
import * as dotenv from "dotenv";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { AgentKit, walletActionProvider, erc20ActionProvider, CdpEvmWalletProvider } from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { recoverTypedDataAddress } from "viem";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

dotenv.config();

const MIN_SCORE = parseInt(process.env.MAINSTREET_MIN_SCORE || "30", 10);
const MS_SIGNER = "0xAC3ca7c5d3cDD7702fd08F9C4C28dAA22296aDa9";

const mainstreetTrustCheck = tool(
  async ({ address }: { address: string }) => {
    const att = await fetch(`https://avisradar.app/api/agent/attestation/${address}`).then((r) => r.json());
    if (!att.payload) return JSON.stringify({ ok: false, reason: "no attestation found" });
    const recovered = await recoverTypedDataAddress({
      domain: att.eip712.domain,
      types: att.eip712.types,
      primaryType: "Attestation",
      message: att.payload,
      signature: att.signature,
    });
    if (recovered.toLowerCase() !== MS_SIGNER.toLowerCase()) return JSON.stringify({ ok: false, reason: "signature invalid" });
    const ageSec = Math.floor(Date.now() / 1000) - Number(att.payload.timestamp);
    if (ageSec > 86400) return JSON.stringify({ ok: false, reason: "attestation stale (>24h)" });
    if (att.payload.score < MIN_SCORE)
      return JSON.stringify({ ok: false, reason: `score ${att.payload.score} < ${MIN_SCORE}` });
    return JSON.stringify({ ok: true, score: att.payload.score, tier: att.payload.score >= 60 ? "high" : "medium" });
  },
  {
    name: "mainstreet_trust_check",
    description: `Check MainStreet reputation BEFORE paying any wallet. Verifies an EIP-712 signed attestation. Returns {ok, score, tier} or {ok: false, reason}. Use this BEFORE every transfer/swap. Free.`,
    schema: z.object({ address: z.string().describe("0x-prefixed wallet to check") }),
  }
);

async function main() {
  const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
    apiKeyId: process.env.CDP_API_KEY_ID!,
    apiKeySecret: process.env.CDP_API_KEY_SECRET!,
    networkId: "base-mainnet",
  });
  const agentkit = await AgentKit.from({
    walletProvider,
    actionProviders: [walletActionProvider(), erc20ActionProvider()],
  });
  const tools = [...(await getLangChainTools(agentkit)), mainstreetTrustCheck];
  const agent = createReactAgent({
    llm: new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 }),
    tools,
    checkpointer: new MemorySaver(),
    messageModifier: `You are a careful onchain payment agent. NEVER send funds to an address without first calling mainstreet_trust_check. If the check returns ok:false, refuse the transfer and explain why.`,
  });
  const config = { configurable: { thread_id: "mainstreet-trust-gate" } };
  console.log(`MainStreet Trust-Gate active. MIN_SCORE=${MIN_SCORE}. Type a request or "exit".`);
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  for (;;) {
    const userInput = await rl.question("\nyou: ");
    if (!userInput || userInput.trim().toLowerCase() === "exit") break;
    const stream = await agent.stream({ messages: [new HumanMessage(userInput)] }, config);
    for await (const chunk of stream) {
      if ("agent" in chunk) console.log("\nagent:", chunk.agent.messages[chunk.agent.messages.length - 1].content);
      else if ("tools" in chunk) console.log("\ntool:", chunk.tools.messages[0].content);
    }
  }
  rl.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
