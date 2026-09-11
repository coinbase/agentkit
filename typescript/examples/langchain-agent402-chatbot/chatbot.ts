import {
  AgentKit,
  ViemWalletProvider,
  walletActionProvider,
  customActionProvider,
  EvmWalletProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { agent402ActionProvider } from "agent402-agentkit";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import * as readline from "readline";
import fs from "fs";
import path from "path";
import { createPublicClient, createWalletClient, encodeDeployData, http, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { z } from "zod";

dotenv.config();

const AGENT402_URL = "https://agent402.tools";
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";

/**
 * Validates that required environment variables are set
 *
 * @throws {Error} - If required environment variables are missing
 * @returns {void}
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];
  const requiredVars = ["OPENAI_API_KEY", "PRIVATE_KEY"];
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });
  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach(varName => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }
}

validateEnvironment();

// AgentKit's analytics call (sendAnalyticsEvent) rejects on a non-2xx from its
// endpoint as an unhandled rejection, which would end the process before the
// first action runs. Telemetry must not decide this run.
process.on("unhandledRejection", reason => {
  console.warn(
    "ignored unhandled rejection:",
    String((reason as Error)?.message || reason).slice(0, 120),
  );
});

// The compiled Agent402PriceSnapshot contract (source beside it). It stores a
// price, the source's timestamp, the source route, the deployer, and the x402
// payment transaction that bought the price, so the purchase and the deployment
// reference each other on the same chain.
const artifact = JSON.parse(
  fs.readFileSync(path.join(__dirname, "contracts", "artifact.json"), "utf8"),
);

// The last settled x402 receipt, captured from the paid retry that agent402_call
// makes. deploy_price_snapshot writes its transaction hash into the contract.
type X402Receipt = { success?: boolean; payer?: string; transaction?: string; network?: string };
let lastReceipt: X402Receipt | null = null;
const receiptFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  const rh = res.headers.get("payment-response");
  if (rh) {
    try {
      lastReceipt = JSON.parse(Buffer.from(rh, "base64").toString("utf8"));
    } catch {
      // keep the previous receipt
    }
  }
  return res;
};

const DeployPriceSnapshotSchema = z.object({
  symbol: z.string().min(1).describe("Asset symbol as bought, e.g. ETH"),
  currency: z.string().min(1).describe("Quote currency as bought, e.g. usd"),
  price: z.number().positive().describe("The price agent402_call returned"),
  observedAt: z
    .string()
    .min(1)
    .describe("The source's own timestamp for the price (the lastUpdated field), ISO 8601"),
});

/**
 * A custom action that deploys the snapshot contract with the price the agent
 * just bought. It reads the x402 receipt from the last agent402_call and refuses
 * if there is none: the contract exists to pin a purchase, not an assertion.
 */
const deployPriceSnapshot = customActionProvider<EvmWalletProvider>({
  name: "deploy_price_snapshot",
  description:
    "Deploy an Agent402PriceSnapshot contract to Base mainnet that stores a price you just bought with " +
    "agent402_call (symbol, currency, price and the source's timestamp) together with the x402 payment " +
    "transaction that bought it. Call agent402_call for the price FIRST; this action reads the payment " +
    "receipt from that call and refuses if there is none. Costs a small amount of ETH for gas. Returns " +
    "the deploy transaction hash, the contract address and the payment transaction it stored.",
  schema: DeployPriceSnapshotSchema,
  invoke: async (
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof DeployPriceSnapshotSchema>,
  ) => {
    if (!lastReceipt?.success || !/^0x[0-9a-f]{64}$/i.test(lastReceipt.transaction || "")) {
      return "Refused: no settled x402 payment receipt from agent402_call is available. Buy the price first.";
    }
    const priceMicro = BigInt(Math.round(args.price * 1e6));
    const observedAt = BigInt(Math.floor(new Date(args.observedAt).getTime() / 1000));
    if (!Number.isFinite(Number(observedAt))) {
      return `Refused: observedAt ${JSON.stringify(args.observedAt)} is not a date.`;
    }
    const data = encodeDeployData({
      abi: artifact.abi,
      bytecode: artifact.bytecode as Hex,
      args: [
        args.symbol,
        args.currency,
        priceMicro,
        observedAt,
        `${new URL(AGENT402_URL).host} GET /api/crypto-price`,
        lastReceipt.transaction as Hex,
      ],
    });
    const hash = await walletProvider.sendTransaction({ data });
    const receipt = await walletProvider.waitForTransactionReceipt(hash);
    if (receipt.status !== "success" || !receipt.contractAddress) {
      return `Deployment ${hash} failed with status ${receipt.status}.`;
    }
    // A load-balanced public RPC can answer from a node behind the block, so read
    // back at the receipt's block and retry a lagging node.
    const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });
    let snapshot: unknown = null;
    for (let attempt = 1; attempt <= 20 && snapshot === null; attempt++) {
      try {
        snapshot = await publicClient.readContract({
          address: receipt.contractAddress,
          abi: artifact.abi,
          functionName: "snapshot",
          args: [],
          blockNumber: receipt.blockNumber,
        });
      } catch {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    return JSON.stringify({
      contract: receipt.contractAddress,
      deployTx: hash,
      paymentTx: lastReceipt.transaction,
      block: String(receipt.blockNumber),
      readBack: snapshot === null ? "not yet visible on the RPC" : String(snapshot),
      links: {
        contract: `https://basescan.org/address/${receipt.contractAddress}`,
        deploy: `https://basescan.org/tx/${hash}`,
        payment: `https://basescan.org/tx/${lastReceipt.transaction}`,
      },
    });
  },
});

/**
 * Initialize the agent with AgentKit, the Agent402 action provider and the
 * deploy action.
 *
 * @returns Agent executor and config
 */
async function initializeAgent() {
  try {
    const llm = new ChatOpenAI({
      model: process.env.LLM_MODEL || "gpt-4o-mini",
      configuration: process.env.OPENAI_BASE_URL
        ? { baseURL: process.env.OPENAI_BASE_URL }
        : undefined,
    });

    const account = privateKeyToAccount(process.env.PRIVATE_KEY as Hex);
    const walletProvider = new ViemWalletProvider(
      createWalletClient({ account, chain: base, transport: http(RPC_URL) }),
    );

    // Agent402 actions: find a tool (free), call it (pays over x402 from this
    // wallet), and what Agent402 is (free). Spend bounds ride with every paid
    // call: no single call over $0.02, no more than $0.25 in a rolling day.
    const agent402 = await agent402ActionProvider({
      baseUrl: AGENT402_URL,
      fetchImpl: receiptFetch,
      maxPerCallUsd: 0.02,
      dailyLimitUsd: 0.25,
    });

    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [walletActionProvider(), agent402, deployPriceSnapshot],
    });

    const tools = await getLangChainTools(agentkit);
    const memory = new MemorySaver();
    const agentConfig = { configurable: { thread_id: "Agent402 AgentKit Chatbot Example!" } };

    const agent = createAgent({
      model: llm,
      tools,
      checkpointer: memory,
      systemPrompt: `
        You are an agent with a wallet on Base mainnet, run through the Coinbase Developer Platform
        AgentKit. You can buy pay-per-call web data from Agent402 over x402 with that wallet
        (agent402_find to pick a tool, agent402_call to buy and run it) and you can deploy an
        Agent402PriceSnapshot contract that pins a price you bought (deploy_price_snapshot). A typical
        instruction is "buy the live ETH price and put it on chain": find the crypto-price tool, call it
        with { coins: "ETH", currency: "usd" }, then deploy the snapshot with the returned price and its
        lastUpdated timestamp, and report the three basescan links. This is mainnet: there is no faucet;
        if the wallet lacks USDC or ETH, report the wallet address and ask the user to fund it. Never
        spend more than the user asked for. If there is a 5XX (internal) HTTP error code, ask the user
        to try again later. Be concise. Refrain from restating your tools' descriptions unless asked.
        `,
    });

    return { agent, config: agentConfig };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
}

/**
 * Stream one turn of the agent and print model responses and tool results.
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 * @param input - The user's message
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runTurn(agent: any, config: any, input: string) {
  const stream = await agent.stream({ messages: [new HumanMessage(input)] }, config);
  for await (const chunk of stream) {
    if ("model_request" in chunk) {
      const response = chunk.model_request.messages[0].content;
      if (response !== "") {
        console.log("\n Response: " + response);
      }
    }
    if ("tools" in chunk) {
      for (const tool of chunk.tools.messages) {
        console.log("Tool " + tool.name + ": " + tool.content);
      }
    }
  }
  console.log("-------------------");
}

/**
 * Run the agent interactively based on user input
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
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
      console.log("-------------------");
      if (userInput.toLowerCase() === "exit") {
        break;
      }
      await runTurn(agent, config, userInput);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

/**
 * Start the chatbot agent. With PROMPT set, runs that single instruction and
 * exits (handy for scripting); otherwise opens chat mode.
 */
async function main() {
  try {
    const { agent, config } = await initializeAgent();
    if (process.env.PROMPT) {
      console.log(`\nPrompt: ${process.env.PROMPT}`);
      console.log("-------------------");
      await runTurn(agent, config, process.env.PROMPT);
      return;
    }
    await runChatMode(agent, config);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  console.log("Starting Agent...");
  main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
