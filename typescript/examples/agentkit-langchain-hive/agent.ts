/**
 * Hive Civilization x402 Agent — LangChain + AgentKit example
 *
 * Demonstrates how to wire HiveActionProvider into an AgentKit agent
 * so it can discover and call any of Hive's ~50 x402-wired services
 * on Base mainnet with USDC micro-payments.
 *
 * Requirements:
 *   OPENAI_API_KEY      — LLM key
 *   CDP_API_KEY_ID      — Coinbase Developer Platform key ID
 *   CDP_API_KEY_SECRET  — Coinbase Developer Platform key secret
 *   CDP_WALLET_SECRET   — CDP wallet secret (Base mainnet wallet with USDC)
 *
 * Optional:
 *   HIVE_MAX_PAYMENT_USDC — cap per call in USDC (default: 0.10)
 */
import { AgentKit, CdpEvmWalletProvider, hiveActionProvider } from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  // 1. Wallet — Base mainnet (Hive services require mainnet USDC)
  const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
    apiKeyId: process.env.CDP_API_KEY_ID!,
    apiKeySecret: process.env.CDP_API_KEY_SECRET!,
    walletSecret: process.env.CDP_WALLET_SECRET!,
    networkId: "base-mainnet",
  });

  // 2. AgentKit — attach HiveActionProvider
  const agentKit = await AgentKit.from({
    walletProvider,
    actionProviders: [
      hiveActionProvider({
        maxPaymentUsdc: parseFloat(process.env.HIVE_MAX_PAYMENT_USDC ?? "0.10"),
      }),
    ],
  });

  // 3. LangChain tools from AgentKit actions
  const tools = await getLangChainTools(agentKit);

  // 4. Agent
  const agent = createReactAgent({
    llm: new ChatOpenAI({ model: "gpt-4o-mini" }),
    tools,
    checkpointSaver: new MemorySaver(),
  });

  // 5. Run — discover services, then submit an evaluator job
  const result = await agent.invoke(
    {
      messages: [
        new HumanMessage(
          "Use hive_discover_services to list available Hive surfaces, " +
          "then call hive_evaluator_submit_job with payload " +
          '{ "model": "gpt-4o-mini", "prompt": "Rate clarity 1-10", "text": "AgentKit + Hive = autonomous AI payments" }.',
        ),
      ],
    },
    { configurable: { thread_id: "hive-demo-1" } },
  );

  console.log(result.messages.at(-1)?.content);
}

main().catch(console.error);
