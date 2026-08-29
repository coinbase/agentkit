import {
  AgentKit,
  CdpEvmWalletProvider,
  walletActionProvider,
  cdpApiActionProvider,
  cdpEvmWalletActionProvider,
  erc20ActionProvider,
  x402ActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import * as readline from "readline";

dotenv.config();

const DEFAULT_KREWE_PREDICT_URL = "https://krewe-orchestrator-production.up.railway.app/v2/predict";
const DEFAULT_MAX_PAYMENT_USDC = 0.1;

/**
 * Validates that required environment variables are set.
 *
 * @throws {Error} - If required environment variables are missing
 * @returns {void}
 */
function validateEnvironment(): void {
  const requiredVars = [
    "OPENAI_API_KEY",
    "CDP_API_KEY_ID",
    "CDP_API_KEY_SECRET",
    "CDP_WALLET_SECRET",
  ];
  const missing = requiredVars.filter(name => !process.env[name]);
  if (missing.length > 0) {
    console.error("Error: Required environment variables are not set");
    missing.forEach(name => console.error(`${name}=your_${name.toLowerCase()}_here`));
    process.exit(1);
  }
  if (!process.env.NETWORK_ID) {
    console.warn("Warning: NETWORK_ID not set, defaulting to base-mainnet (krewe is mainnet-only today)");
  }
}

validateEnvironment();

/**
 * Initialize the agent with AgentKit + the krewe x402 inference service.
 *
 * @returns Agent executor and config
 */
async function initializeAgent() {
  const llm = new ChatOpenAI({ model: "gpt-4o-mini" });

  const networkId = process.env.NETWORK_ID || "base-mainnet";

  const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
    walletSecret: process.env.CDP_WALLET_SECRET,
    idempotencyKey: process.env.IDEMPOTENCY_KEY,
    address: process.env.ADDRESS as `0x${string}` | undefined,
    networkId,
    rpcUrl: process.env.RPC_URL,
  });

  // krewe is an x402-paywalled inference network on Base mainnet. The
  // built-in x402ActionProvider does the entire handshake: 402 challenge,
  // EIP-3009 signature, on-chain USDC settlement, and the actual call.
  //
  // Pricing per call (USDC base units, 6 decimals):
  //   $0.005 text.structure   ·   $0.01  text.embed
  //   $0.02  web.scrape       ·   $0.05  text.complete
  //
  // Every USDC paid here is swept hourly by krewe's buyback service, swapped
  // for $KREW on Uniswap V4, and deposited back into the registry's reward
  // pool — so each call directly funds the miners that answered it.
  const kreweUrl = process.env.KREWE_PREDICT_URL ?? DEFAULT_KREWE_PREDICT_URL;
  const maxPaymentUsdc = Number(process.env.KREWE_MAX_PAYMENT_USDC ?? DEFAULT_MAX_PAYMENT_USDC);

  const actionProviders = [
    walletActionProvider(),
    cdpApiActionProvider(),
    cdpEvmWalletActionProvider(),
    erc20ActionProvider(),
    x402ActionProvider({
      registeredServices: [kreweUrl],
      allowDynamicServiceRegistration: false,
      maxPaymentUsdc,
      registeredFacilitators: {},
    }),
  ];

  const agentkit = await AgentKit.from({ walletProvider, actionProviders });
  const tools = await getLangChainTools(agentkit);

  const memory = new MemorySaver();
  const agentConfig = { configurable: { thread_id: "krewe Inference Chatbot Example" } };

  const agent = createAgent({
    model: llm,
    tools,
    checkpointer: memory,
    systemPrompt: `
You are an onchain agent with access to:
  • A CDP EVM wallet on Base.
  • The krewe inference network at ${kreweUrl}, accessed via the x402
    action provider. krewe is a decentralized AI inference network — your
    wallet pays USDC per call (cap: $${maxPaymentUsdc}). The supported job
    kinds are text.structure (regex/JSON extraction, $0.005), text.embed
    (sentence embeddings, $0.01), web.scrape (clean HTML fetch, $0.02),
    and text.complete (small-LM completion, $0.05).

When a user asks for structured extraction, embeddings, a clean scrape,
or a quick small-model completion, prefer routing through krewe via the
x402 service — it pays krewe miners and gets a 2-of-3 consensus output.

Always include the relevant body when calling the krewe endpoint:
  { "kind": "text.structure" | "text.embed" | "web.scrape" | "text.complete",
    "payload": <kind-specific JSON> }

If a call returns 402 'payment-required', the x402 provider handles the
signature + settlement automatically — just retry once via the same tool.

Be concise. If you can't do something with your current tools, say so.
`,
  });

  return { agent, config: agentConfig };
}

/**
 * Run the agent interactively based on user input.
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runChatMode(agent: any, config: any) {
  console.log("Starting chat mode... Type 'exit' to end.");
  console.log("Try: \"Extract emails and dates from this text: Email hi@krewe.world by 2026-05-17\"");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const userInput = await question("\nPrompt: ");
      console.log("-------------------");
      if (userInput.toLowerCase() === "exit") break;

      const stream = await agent.stream({ messages: [new HumanMessage(userInput)] }, config);

      for await (const chunk of stream) {
        if ("model_request" in chunk) {
          const response = chunk.model_request.messages[0].content;
          if (response !== "") console.log("\n Response: " + response);
        }
        if ("tools" in chunk) {
          for (const tool of chunk.tools.messages) {
            console.log("Tool " + tool.name + ": " + tool.content);
          }
        }
      }
      console.log("-------------------");
    }
  } catch (error) {
    if (error instanceof Error) console.error("Error:", error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

/**
 * Run the agent autonomously — picks a creative krewe inference job each
 * tick to exercise the network.
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 * @param interval - Time interval between actions in seconds
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runAutonomousMode(agent: any, config: any, interval = 30) {
  console.log("Starting autonomous mode...");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const thought =
        "Pick an interesting short snippet of text or a public URL and route a krewe job through " +
        "the x402 service to do something useful with it (extract structured data, embed, summarize, " +
        "or scrape). Tell me the kind you chose, the payment cost, and the resulting output.";

      const stream = await agent.stream({ messages: [new HumanMessage(thought)] }, config);

      for await (const chunk of stream) {
        if ("model_request" in chunk) {
          const response = chunk.model_request.messages[0].content;
          if (response !== "") console.log("\n Response: " + response);
        }
        if ("tools" in chunk) {
          for (const tool of chunk.tools.messages) {
            console.log("Tool " + tool.name + ": " + tool.content);
          }
        }
      }
      console.log("-------------------");

      await new Promise(resolve => setTimeout(resolve, interval * 1000));
    } catch (error) {
      if (error instanceof Error) console.error("Error:", error.message);
      process.exit(1);
    }
  }
}

/**
 * Choose whether to run in autonomous or chat mode based on user input.
 *
 * @returns Selected mode
 */
async function chooseMode(): Promise<"chat" | "auto"> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  // eslint-disable-next-line no-constant-condition
  while (true) {
    console.log("\nAvailable modes:");
    console.log("1. chat    - Interactive chat mode");
    console.log("2. auto    - Autonomous action mode");

    const choice = (await question("\nChoose a mode (enter number or name): "))
      .toLowerCase()
      .trim();
    if (choice === "1" || choice === "chat") {
      rl.close();
      return "chat";
    } else if (choice === "2" || choice === "auto") {
      rl.close();
      return "auto";
    }
    console.log("Invalid choice. Please try again.");
  }
}

/**
 * Start the chatbot agent.
 */
async function main() {
  try {
    const { agent, config } = await initializeAgent();
    const mode = await chooseMode();
    if (mode === "chat") await runChatMode(agent, config);
    else await runAutonomousMode(agent, config);
  } catch (error) {
    if (error instanceof Error) console.error("Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  console.log("Starting krewe-inference agent...");
  main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
