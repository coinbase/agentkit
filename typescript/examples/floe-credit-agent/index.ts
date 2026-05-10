/**
 * Floe Financial OS — End-to-End Example
 *
 * The full financial loop:
 *   1. Check available markets (getMarkets)
 *   2. Deposit USDC, borrow 95% as working capital (instantBorrow)
 *   3. Call a paid x402 API — Floe handles payment (x402Fetch)
 *   4. Check credit status (checkStatus)
 *   5. Repay — deposit returns automatically (repay)
 *
 * Floe is the Financial OS for AI agents — wallet, fiat on/off-ramp,
 * working capital, x402 payments, and portable credit in one provider.
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
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY is required — see .env.example");
  if (!process.env.RPC_URL) throw new Error("RPC_URL is required — see .env.example");
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required — see .env.example");

  // 1. Setup wallet
  const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
  const client = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.RPC_URL),
  });
  const walletProvider = new ViemWalletProvider(client);

  // 2. Create AgentKit with Floe Financial OS
  const agentkit = await AgentKit.from({
    walletProvider,
    actionProviders: [new FloeActionProvider()],
  });

  const tools = getVercelAITools(agentkit);

  // 3. Run the financial loop
  console.log("🚀 Floe Financial OS Agent starting...\n");

  const { text } = await generateText({
    model: openai("gpt-4o"),
    tools,
    maxSteps: 10,
    system: `You are an AI agent on Base with access to the Floe Financial OS.

Your task — execute the full financial loop:
1. Check what lending markets are available
2. Deposit 10,000 USDC and borrow 9,500 USDC working capital at max 10% APR for 14 days
3. Check the loan status and remaining credit
4. Report what happened — include the loan ID, rate, and credit available

Be concise. Report numbers clearly. This demonstrates the complete
fund → borrow → spend → repay lifecycle.`,
    prompt: "Execute the financial loop described in your instructions.",
  });

  console.log("\n📊 Agent output:\n");
  console.log(text);
}

main().catch(console.error);
