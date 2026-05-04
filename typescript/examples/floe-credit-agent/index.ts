/**
 * Floe Credit Agent — End-to-End Example
 *
 * Demonstrates the full credit lifecycle:
 *   1. Deposit USDC, borrow USDC working capital (fixed rate, no price risk)
 *   2. Call a paid x402 API using Floe's credit delegation
 *   3. Check loan health and accrued interest
 *   4. Repay — collateral returns automatically
 *
 * This is the first working capital provider in AgentKit.
 * Unlike Compound/Morpho (variable-rate pools), Floe offers
 * per-loan isolated escrow with no pool contagion risk.
 */

import "dotenv/config";
import { AgentKit, ViemWalletProvider, FloeActionProvider } from "@coinbase/agentkit";
import { getVercelAITools } from "@coinbase/agentkit-vercel-ai-sdk";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

async function main() {
  // Validate required env vars
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY is required in .env");
  if (!process.env.RPC_URL) throw new Error("RPC_URL is required in .env");
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required in .env");

  // 1. Setup wallet
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
  const client = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.RPC_URL),
  });
  const walletProvider = new ViemWalletProvider(client);

  // 2. Create AgentKit with Floe working capital actions
  const agentkit = await AgentKit.from({
    walletProvider,
    actionProviders: [new FloeActionProvider()],
  });

  const tools = getVercelAITools(agentkit);

  // 3. Run the agent
  console.log("🚀 Floe Credit Agent starting...\n");

  const { text } = await generateText({
    model: openai("gpt-4o"),
    tools,
    maxSteps: 10,
    system: `You are a DeFi agent on Base that uses Floe for fixed-rate credit.
Your task:
1. Check what lending markets are available
2. Deposit 10,000 USDC and borrow 9,500 USDC working capital at max 10% APR for 14 days
3. Check the loan status
4. Report what happened

Be concise. Report numbers clearly.`,
    prompt: "Execute the credit workflow described in your system prompt.",
  });

  console.log("\n📊 Agent output:\n");
  console.log(text);
}

main().catch(console.error);
