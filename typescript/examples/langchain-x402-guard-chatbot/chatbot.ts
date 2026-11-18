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
import { meronaGuardActionProvider } from "./meronaGuard";

dotenv.config();

/**
 * Validates that required environment variables are set.
 *
 * @throws {Error} If required environment variables are missing.
 * @returns {void}
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];
  const requiredVars = ["OPENAI_API_KEY", "CDP_API_KEY_ID", "CDP_API_KEY_SECRET", "CDP_WALLET_SECRET"];
  requiredVars.forEach(varName => {
    if (!process.env[varName]) missingVars.push(varName);
  });
  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach(varName => console.error(`${varName}=your_${varName.toLowerCase()}_here`));
    process.exit(1);
  }
  if (!process.env.NETWORK_ID) {
    console.warn("Warning: NETWORK_ID not set, defaulting to base-sepolia testnet");
  }
}

validateEnvironment();

/**
 * Initialize the agent with AgentKit, the x402 action provider, and the opt-in
 * merona pre-payment guard.
 *
 * @returns {Promise<{ agent: unknown; config: unknown }>} The agent and its config.
 */
async function initializeAgent() {
  const llm = new ChatOpenAI({ model: "gpt-4o-mini" });

  const networkId = process.env.NETWORK_ID || "base-sepolia";

  const walletProvider = await CdpEvmWalletProvider.configureWithWallet({
    apiKeyId: process.env.CDP_API_KEY_ID,
    apiKeySecret: process.env.CDP_API_KEY_SECRET,
    walletSecret: process.env.CDP_WALLET_SECRET,
    idempotencyKey: process.env.IDEMPOTENCY_KEY,
    address: process.env.ADDRESS as `0x${string}` | undefined,
    networkId,
    rpcUrl: process.env.RPC_URL,
  });

  // x402 configuration
  const x402Config = {
    registeredServices: networkId === "base-sepolia" ? ["https://www.x402.org/protected"] : [],
    allowDynamicServiceRegistration: false,
    maxPaymentUsdc: 1.0,
    registeredFacilitators: {},
  };

  const agentkit = await AgentKit.from({
    walletProvider,
    actionProviders: [
      walletActionProvider(),
      cdpApiActionProvider(),
      cdpEvmWalletActionProvider(),
      erc20ActionProvider(),
      x402ActionProvider(x402Config), // make_http_request, retry_http_request_with_x402, ...
      meronaGuardActionProvider(), // check_x402_seller  (this example)
    ],
  });

  const tools = await getLangChainTools(agentkit);
  const memory = new MemorySaver();
  const agentConfig = { configurable: { thread_id: "x402 buy-loop with merona guard" } };

  const agent = createAgent({
    model: llm,
    tools,
    checkpointer: memory,
    systemPrompt: `
      You are an agent that can pay for x402 APIs onchain using Coinbase AgentKit.

      The buy loop is: inspect -> check -> decide -> pay.
      When a request returns HTTP 402:
        1. Call make_http_request to read the payment requirements.
        2. Take the seller 'payTo' and 'network' from those requirements and call
           check_x402_seller with them.
        3. Only call retry_http_request_with_x402 if the check is NOT a FAIL.
           If the check is UNCERTAIN, tell the user what it says and ask before paying.
           If it is a FAIL, do not pay; report the recorded reason.

      The check is free and fail-soft: if it is unavailable it returns UNCERTAIN,
      which is a signal, not an error. Before your first action, get the wallet
      details to see what network you're on. Be concise.
      `,
  });

  return { agent, config: agentConfig };
}

/**
 * Run the agent interactively based on user input.
 *
 * @param {unknown} agent - The agent executor.
 * @param {unknown} config - Agent configuration.
 * @returns {Promise<void>}
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runChatMode(agent: any, config: any) {
  console.log("Starting chat mode... Type 'exit' to end.");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const userInput = await question("\nPrompt: ");
      if (userInput.toLowerCase() === "exit") break;

      const stream = await agent.stream({ messages: [new HumanMessage(userInput)] }, config);
      for await (const chunk of stream) {
        if ("model_request" in chunk) {
          const response = chunk.model_request.messages[0].content;
          if (response !== "") console.log("\n" + response);
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
 * Start the chatbot agent.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const { agent, config } = await initializeAgent();
  await runChatMode(agent, config);
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
