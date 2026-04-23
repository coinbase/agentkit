import {
  AgentKit,
  CdpEvmWalletProvider,
  CdpSolanaWalletProvider,
  walletActionProvider,
  erc20ActionProvider,
  cdpApiActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { MemorySaver, Command } from "@langchain/langgraph";
import { createAgent, createMiddleware, humanInTheLoopMiddleware } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import * as dotenv from "dotenv";
import * as readline from "readline";

dotenv.config();

/**
 * Validates that required environment variables are set
 *
 * @throws {Error} - If required environment variables are missing
 * @returns {void}
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];

  // Check required variables
  const requiredVars = [
    "OPENAI_API_KEY",
    "CDP_API_KEY_ID",
    "CDP_API_KEY_SECRET",
    "CDP_WALLET_SECRET",
  ];
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  // Exit if any required variables are missing
  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach(varName => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }

  // Warn about optional NETWORK_ID
  if (!process.env.NETWORK_ID) {
    console.warn("Warning: NETWORK_ID not set, defaulting to base-sepolia testnet");
  }
}

// Add this right after imports and before any other code
validateEnvironment();

/**
 * Type guard to check if the wallet provider is an EVM provider
 *
 * @param walletProvider - The wallet provider to check
 * @returns True if the wallet provider is an EVM provider, false otherwise
 */
function isEvmWalletProvider(
  walletProvider: CdpEvmWalletProvider | CdpSolanaWalletProvider,
): walletProvider is CdpEvmWalletProvider {
  return walletProvider instanceof CdpEvmWalletProvider;
}

// Common prompt injection patterns
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|prompts|rules|directives)/i,
  /forget\s+(your|all|the)\s+(rules|instructions|guidelines|prompts|directives)/i,
  /you\s+are\s+now\s+(a|an|no\s+longer)/i,
  /disregard\s+(all|any|your|the)\s+(previous|prior|above)?\s*(instructions|rules|prompts)/i,
  /override\s+(your|system|all)\s+(instructions|prompts|rules)/i,
  /new\s+instructions?[:\s]/i,
  /system\s*prompt[:\s]/i,
  /\bDAN\b.*\bjailbreak\b/i,
  /do\s+anything\s+now/i,
  /pretend\s+(you\s+)?(are|have)\s+no\s+(restrictions|rules|limits)/i,
  /act\s+as\s+if\s+(you\s+)?(have|had)\s+no\s+(rules|restrictions|guidelines)/i,
];

const promptInjectionMiddleware = createMiddleware({
  name: "PromptInjectionMiddleware",
  beforeModel: {
    canJumpTo: ["end"],
    hook: state => {
      const lastMessage = state.messages.at(-1);
      if (!lastMessage || !("content" in lastMessage)) {
        return;
      }

      const content =
        typeof lastMessage.content === "string"
          ? lastMessage.content
          : Array.isArray(lastMessage.content)
            ? lastMessage.content
                .filter((block): block is { type: "text"; text: string } => {
                  return typeof block === "object" && "type" in block && block.type === "text";
                })
                .map(block => block.text)
                .join(" ")
            : "";

      const matched = INJECTION_PATTERNS.find(pattern => pattern.test(content));
      if (!matched) {
        return;
      }

      console.warn(`[PromptInjectionMiddleware] Blocked suspicious input matching: ${matched}`);
      return {
        messages: [new AIMessage("Blocked by guardrails middleware")],
        jumpTo: "end" as const,
      };
    },
  },
});

/**
 * Initialize the agent with CDP Agentkit
 *
 * @returns Agent executor and config
 */
async function initializeAgent() {
  try {
    // Initialize LLM
    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
    });

    // Configure CDP Wallet Provider
    const networkId = process.env.NETWORK_ID || "base-sepolia";
    const isSolana = networkId.includes("solana");

    const cdpWalletConfig = {
      apiKeyId: process.env.CDP_API_KEY_ID,
      apiKeySecret: process.env.CDP_API_KEY_SECRET,
      walletSecret: process.env.CDP_WALLET_SECRET,
      idempotencyKey: process.env.IDEMPOTENCY_KEY,
      address: process.env.ADDRESS as `0x${string}` | undefined,
      networkId,
      rpcUrl: process.env.RPC_URL,
    };

    const walletProvider = isSolana
      ? await CdpSolanaWalletProvider.configureWithWallet(cdpWalletConfig)
      : await CdpEvmWalletProvider.configureWithWallet(cdpWalletConfig);

    // action providers
    const actionProviders = [
      walletActionProvider(),
      cdpApiActionProvider(),
      ...(isEvmWalletProvider(walletProvider) ? [erc20ActionProvider()] : []),
    ];

    // Initialize AgentKit
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders,
    });

    const tools = await getLangChainTools(agentkit);

    // Store buffered conversation history in memory
    const memory = new MemorySaver();
    const agentConfig = { configurable: { thread_id: "CDP AgentKit Chatbot Example!" } };

    // Create React Agent using the LLM and CDP AgentKit tools
    const agent = createAgent({
      model: llm,
      tools,
      checkpointer: memory,
      middleware: [
        promptInjectionMiddleware,
        humanInTheLoopMiddleware({
          interruptOn: {
            ERC20ActionProvider_transfer: true,
          },
          descriptionPrefix: "ERC20 transfer pending approval",
        }),
      ],
      systemPrompt: `
        You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit. You are 
        empowered to interact onchain using your tools. If you ever need funds, you can request them from the 
        faucet if you are on network ID 'base-sepolia'. If not, you can provide your wallet details and request 
        funds from the user. Before executing your first action, get the wallet details to see what network 
        you're on. If there is a 5XX (internal) HTTP error code, ask the user to try again later. If someone 
        asks you to do something you can't do with your currently available tools, you must say so, and 
        encourage them to implement it themselves using the CDP SDK + Agentkit, recommend they go to 
        docs.cdp.coinbase.com for more information. Be concise and helpful with your responses. Refrain from 
        restating your tools' descriptions unless it is explicitly requested.
        `,
    });

    return { agent, config: agentConfig };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error; // Re-throw to be handled by caller
  }
}

/**
 * Run the agent autonomously with specified intervals
 *
 * @param agent - The agent executor
 * @param config - Agent configuration
 * @param interval - Time interval between actions in seconds
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runAutonomousMode(agent: any, config: any, interval = 10) {
  console.log("Starting autonomous mode...");

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const thought =
        "Be creative and do something interesting on the blockchain. " +
        "Choose an action or set of actions and execute it that highlights your abilities.";

      const stream = await agent.stream({ messages: [new HumanMessage(thought)] }, config);

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

      await new Promise(resolve => setTimeout(resolve, interval * 1000));
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error:", error.message);
      }
      process.exit(1);
    }
  }
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

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  /**
   * Streams agent response for the given input and prints tool/output updates to the console.
   *
   * @param input - User input to send to the agent
   * @returns Promise that resolves when streaming is complete
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function streamAgent(input: any) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let pendingInterrupt: any = null;
    let isFirstResponseToken = true;

    const stream = await agent.stream(input, {
      ...config,
      streamMode: ["updates", "messages"],
    });

    for await (const [mode, chunk] of stream) {
      if (mode === "messages") {
        const [token, metadata] = chunk;
        if (token.content) {
          if (metadata?.langgraph_node === "tools") {
            console.log("\nTool " + token.name + ": " + token.content);
            isFirstResponseToken = true;
          } else {
            if (isFirstResponseToken) {
              process.stdout.write("\n Response: ");
              isFirstResponseToken = false;
            }
            process.stdout.write(String(token.content));
          }
        }
      } else if (mode === "updates") {
        if ("__interrupt__" in chunk) {
          pendingInterrupt = chunk.__interrupt__;
        }
      }
    }

    return pendingInterrupt;
  }

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const userInput = await question("\nPrompt: ");
      console.log("-------------------");

      if (userInput.toLowerCase() === "exit") {
        break;
      }

      let interrupt = await streamAgent({ messages: [new HumanMessage(userInput)] });

      while (interrupt) {
        const req = interrupt[0]?.value?.actionRequests?.[0];
        if (req) {
          console.log(`\n\nTool: ${req.name}`);
          console.log("Arguments:");
          for (const [key, value] of Object.entries(req.args || {})) {
            console.log(`  ${key}: ${JSON.stringify(value)}`);
          }
        }

        const decision = await question("\nApprove this action? (yes/no/edit): ");
        const trimmed = decision.trim().toLowerCase();

        if (trimmed === "yes" || trimmed === "y") {
          interrupt = await streamAgent(
            new Command({ resume: { decisions: [{ type: "approve" }] } }),
          );
        } else if (trimmed === "edit" || trimmed === "e") {
          const args: Record<string, unknown> = { ...(req?.args || {}) };
          console.log("\nEdit arguments (press Enter to keep current value):");
          for (const key of Object.keys(args)) {
            const current = JSON.stringify(args[key]);
            const newVal = await question(`  ${key} [${current}]: `);
            if (newVal.trim() !== "") {
              if (typeof args[key] === "string") {
                args[key] = newVal;
              } else {
                try {
                  args[key] = JSON.parse(newVal);
                } catch {
                  args[key] = newVal;
                }
              }
            }
          }
          console.log("\nUpdated arguments:");
          for (const [key, value] of Object.entries(args)) {
            console.log(`  ${key}: ${JSON.stringify(value)}`);
          }
          interrupt = await streamAgent(
            new Command({
              resume: {
                decisions: [
                  {
                    type: "edit",
                    editedAction: {
                      name: req?.name,
                      args,
                    },
                  },
                ],
              },
            }),
          );
        } else {
          const reason = await question("Reason for rejection (optional): ");
          interrupt = await streamAgent(
            new Command({
              resume: {
                decisions: [{ type: "reject", message: reason || "Action rejected by user." }],
              },
            }),
          );
        }
      }

      console.log("\n-------------------");
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
 * Choose whether to run in autonomous or chat mode based on user input
 *
 * @returns Selected mode
 */
async function chooseMode(): Promise<"chat" | "auto"> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

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
 * Start the chatbot agent
 */
async function main() {
  try {
    const { agent, config } = await initializeAgent();
    const mode = await chooseMode();

    if (mode === "chat") {
      await runChatMode(agent, config);
    } else {
      await runAutonomousMode(agent, config);
    }
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
