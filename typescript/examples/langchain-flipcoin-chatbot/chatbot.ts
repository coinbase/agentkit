import { AgentKit, ViemWalletProvider, flipcoinActionProvider } from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import * as readline from "readline";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

dotenv.config();

const systemPrompt = `
You are an autonomous prediction-market trader built on top of FlipCoin (https://www.flipcoin.fun),
the LMSR prediction-market protocol on Base. You have access to the following FlipCoin tools:

  - get_prediction_markets — list tradable markets (title, conditionId, YES/NO prices, volume).
  - get_market_odds — fetch a firm quote for a market (price, sharesOut, priceImpact, fee).
  - buy_prediction_shares — buy YES or NO shares (USDC is debited from the agent's vault).
  - sell_prediction_shares — sell YES or NO shares back for USDC.
  - get_agent_portfolio — your open/resolved positions and unrealized P&L.

Trading heuristics:

  1. Always call get_prediction_markets first to discover what's tradable.
  2. For any market you consider, call get_market_odds with a concrete USDC amount to preview
     sharesOut, priceImpactBps and fee before committing.
  3. Reject trades where priceImpactGuard.level is "blocked" (the protocol already vetoed it).
  4. Prefer markets with sensible liquidity (liquidityUsdc > 50) and recent activity.
  5. Prices are basis points: 5000 = 50%. A price of 6000 means the market thinks YES is 60%
     likely. Only buy YES if you actually believe the event is MORE than 60% likely, and
     similarly for NO.
  6. Size positions modestly (0.5–2 USDC by default) — slippage scales with size.
  7. After trading, call get_agent_portfolio to verify the fill.

Be honest about uncertainty. If you don't have a real edge, say so and skip the trade.
`;

/**
 * Initialize the AgentKit agent with a FlipCoin action provider.
 *
 * @returns The compiled LangGraph agent and its configuration.
 */
async function initialize() {
  const privateKey = process.env.PRIVATE_KEY as `0x${string}`;
  const flipcoinApiKey = process.env.FLIPCOIN_API_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY is required in .env");
  if (!flipcoinApiKey) throw new Error("FLIPCOIN_API_KEY is required in .env");

  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(process.env.BASE_RPC_URL ?? undefined),
  });
  const walletProvider = new ViemWalletProvider(walletClient);

  const agentKit = await AgentKit.from({
    walletProvider,
    actionProviders: [
      flipcoinActionProvider({
        apiKey: flipcoinApiKey,
        baseUrl: process.env.FLIPCOIN_BASE_URL,
      }),
    ],
  });

  const tools = await getLangChainTools(agentKit);
  const llm = new ChatOpenAI({ model: "gpt-4o-mini" });
  const memory = new MemorySaver();

  const agent = createAgent({
    model: llm,
    tools,
    checkpointer: memory,
    systemPrompt,
  });

  const agentConfig = { configurable: { thread_id: "FlipCoin AgentKit Chatbot Example" } };

  return { agent, config: agentConfig, walletAddress: account.address };
}

/**
 * Run the agent in interactive chat mode.
 *
 * @param agent - The compiled LangGraph agent.
 * @param config - Agent configuration.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runChatMode(agent: any, config: any) {
  console.log("Chat mode ready. Type 'exit' to quit.\n");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>(resolve => rl.question(q, resolve));

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const input = (await ask("You > ")).trim();
    if (!input) continue;
    if (input === "exit") break;

    const stream = await agent.stream({ messages: [new HumanMessage(input)] }, config);
    for await (const chunk of stream) {
      if ("model_request" in chunk) {
        const msg = chunk.model_request.messages[0];
        if (msg?.content) console.log(`\nAgent > ${msg.content}\n`);
      }
    }
  }
  rl.close();
}

/**
 * Run the agent autonomously: scan markets, decide, trade, repeat.
 *
 * @param agent - The compiled LangGraph agent.
 * @param config - Agent configuration.
 * @param intervalSeconds - Delay between iterations.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runAutonomousMode(agent: any, config: any, intervalSeconds = 120) {
  console.log("Autonomous bettor mode started — press Ctrl-C to stop.\n");

  const thoughts = [
    "Scan the top 10 active FlipCoin markets. Pick the single market where you think the current price is MOST mispriced relative to public information you know about the topic. Preview a $1 trade with get_market_odds. If the edge is real and priceImpactGuard is OK, place the trade. Otherwise skip and explain why.",
    "Review your current portfolio with get_agent_portfolio. For any position where the market price has moved clearly in your favor (unrealized P&L > 20% of cost), consider taking profit by selling. Explain your reasoning.",
    "List active markets in the 'crypto' category. Pick the one with the highest volume. Preview a $0.50 trade and execute only if the priceImpactBps is under 100 (1%).",
  ];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const thought = thoughts[Math.floor(Math.random() * thoughts.length)];
      console.log(`\n---\n[${new Date().toISOString()}] Agent thought:\n${thought}\n---`);

      const stream = await agent.stream({ messages: [new HumanMessage(thought)] }, config);
      for await (const chunk of stream) {
        if ("model_request" in chunk) {
          const msg = chunk.model_request.messages[0];
          if (msg?.content) console.log(`Agent > ${msg.content}`);
        }
      }
      await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
    } catch (error) {
      console.error("Autonomous iteration failed:", error);
      await new Promise(resolve => setTimeout(resolve, 15_000));
    }
  }
}

/**
 * Entry point — pick chat or autonomous mode from CLI.
 */
async function main() {
  const { agent, config, walletAddress } = await initialize();
  console.log(`FlipCoin agent ready. Trader wallet: ${walletAddress}`);

  const mode = process.argv[2] ?? "chat";
  if (mode === "autonomous" || mode === "auto") {
    await runAutonomousMode(agent, config, Number(process.env.AGENT_INTERVAL_SECONDS ?? 120));
  } else {
    await runChatMode(agent, config);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
