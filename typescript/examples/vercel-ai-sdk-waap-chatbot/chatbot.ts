import {
  AgentKit,
  WaapWalletProvider,
  EvmWalletProvider,
  customActionProvider,
  erc20ActionProvider,
  pythActionProvider,
  walletActionProvider,
  wethActionProvider,
} from "@coinbase/agentkit";
import { getVercelAITools } from "@coinbase/agentkit-vercel-ai-sdk";
import { openai } from "@ai-sdk/openai";
import { streamText, ToolSet, stepCountIs } from "ai";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as readline from "readline";
import { z } from "zod";

dotenv.config();

const WALLET_DATA_FILE = "wallet_data.txt";

const SignMessageSchema = z.object({
  message: z.string().describe("The message to sign."),
});

const SignTypedDataSchema = z.object({
  typedData: z.record(z.string(), z.any()).optional().describe("Full EIP-712 typed data object."),
  typedDataJson: z.string().optional().describe("Stringified JSON for EIP-712 typed data."),
  domain: z.record(z.string(), z.any()).optional().describe("EIP-712 domain object."),
  types: z
    .record(z.string(), z.array(z.object({ name: z.string(), type: z.string() })))
    .optional()
    .describe("EIP-712 type definitions."),
  primaryType: z.string().optional().describe("Primary type name for typed data."),
  message: z.record(z.string(), z.any()).optional().describe("EIP-712 message payload."),
});

const ReadContractSchema = z.object({
  contractAddress: z.string().describe("The contract address to query."),
  abi: z.array(z.record(z.string(), z.any())).describe("Contract ABI array."),
  functionName: z.string().describe("Name of the view/pure function to call."),
  args: z.array(z.any()).optional().describe("Function arguments."),
});

const waapAdvancedActions = customActionProvider<EvmWalletProvider>([
  {
    name: "sign_message",
    description:
      "Sign an arbitrary message with the connected WaaP wallet using personal_sign semantics.",
    schema: SignMessageSchema,
    invoke: async (walletProvider, args) => {
      const signature = await walletProvider.signMessage(args.message);
      return `Message signature: ${signature}`;
    },
  },
  {
    name: "sign_typed_data",
    description:
      "Sign EIP-712 typed data with the connected WaaP wallet. Input must include domain, types, primaryType, and message.",
    schema: SignTypedDataSchema,
    invoke: async (walletProvider, args) => {
      let typedDataPayload: Record<string, unknown> | undefined = args.typedData;

      if (!typedDataPayload && args.typedDataJson) {
        typedDataPayload = JSON.parse(args.typedDataJson) as Record<string, unknown>;
      }

      if (!typedDataPayload && args.domain && args.types && args.primaryType && args.message) {
        typedDataPayload = {
          domain: args.domain,
          types: args.types,
          primaryType: args.primaryType,
          message: args.message,
        };
      }

      if (!typedDataPayload) {
        throw new Error(
          "Missing typed data. Provide typedData, typedDataJson, or domain/types/primaryType/message.",
        );
      }

      const signature = await walletProvider.signTypedData(typedDataPayload);
      return `Typed data signature: ${signature}`;
    },
  },
  {
    name: "read_contract",
    description:
      "Read a pure/view function from a smart contract using contract address, ABI, function name, and args.",
    schema: ReadContractSchema,
    invoke: async (walletProvider, args) => {
      const result = await walletProvider.readContract({
        address: args.contractAddress as `0x${string}`,
        abi: args.abi,
        functionName: args.functionName,
        args: args.args ?? [],
      });
      return `Contract read result: ${JSON.stringify(result, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      )}`;
    },
  },
]);

/**
 * Validates required environment variables.
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];

  const requiredVars = ["OPENAI_API_KEY", "WAAP_EMAIL", "WAAP_PASSWORD"];
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

  if (!process.env.WAAP_CHAIN_ID) {
    console.warn("Warning: WAAP_CHAIN_ID not set, defaulting to 84532 (Base Sepolia)");
  }
}

validateEnvironment();

const system = `You are a helpful agent with a WaaP (Wallet as a Protocol) wallet that can interact onchain
using the Coinbase Developer Platform AgentKit. Your wallet uses two-party computation (2PC)
for key security - private keys are never fully exposed in any single location.

You are empowered to interact onchain using your tools. If you ever need funds, you can request
them from the faucet if you are on network ID 'base-sepolia'. If not, you can provide your wallet
details and request funds from the user. Before executing your first action, get the wallet details
to see what network you're on. If there is a 5XX (internal) HTTP error code, ask the user to try
again later. If someone asks you to do something you can't do with your currently available tools,
you must say so, and encourage them to implement it themselves using the CDP SDK + AgentKit,
recommend they go to docs.cdp.coinbase.com for more information. Be concise and helpful with your
responses. Refrain from restating your tools' descriptions unless it is explicitly requested.`;

const signingInstructions = `When the user asks to sign a message or sign EIP-712 typed data, you must call the appropriate signing tool directly.
Do not refuse unless a tool call actually fails. If a signing tool fails, return the exact error and ask for corrected input.`;

/**
 * Initializes AgentKit with WaaP wallet and actions.
 *
 * @returns Initialized Vercel AI SDK tools.
 */
async function initializeAgent() {
  try {
    const chainId = process.env.WAAP_CHAIN_ID || "84532";

    const walletProvider = WaapWalletProvider.configureWithWallet({
      cliPath: process.env.WAAP_CLI_PATH,
      chainId,
      rpcUrl: process.env.WAAP_RPC_URL,
      email: process.env.WAAP_EMAIL,
      password: process.env.WAAP_PASSWORD,
    });

    console.log(`WaaP wallet address: ${walletProvider.getAddress()}`);
    console.log(`Network: ${JSON.stringify(walletProvider.getNetwork())}`);

    const agentKit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        wethActionProvider(),
        pythActionProvider(),
        walletActionProvider(),
        erc20ActionProvider(),
        waapAdvancedActions,
      ],
    });

    const tools = getVercelAITools(agentKit);

    const exportedWallet = walletProvider.exportWallet();
    fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(exportedWallet));

    return { tools };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
}

/**
 * Runs interactive chat mode.
 *
 * @param tools - Vercel AI SDK tools.
 */
async function runChatMode(tools: ToolSet) {
  console.log("Starting chat mode... Type 'exit' to end.");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve));

  const messages: Parameters<typeof streamText>[0]["messages"] = [];

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const userInput = await question("\nPrompt: ");
      console.log("-------------------");

      if (userInput.toLowerCase() === "exit") {
        break;
      }

      messages.push({ role: "user", content: userInput });

      const result = streamText({
        model: openai.chat("gpt-4o-mini"),
        messages,
        tools,
        system: `${system}\n\n${signingInstructions}`,
        stopWhen: stepCountIs(10),
        onStepFinish: async ({ toolResults }) => {
          for (const tr of toolResults) {
            console.log(`Tool ${tr.toolName}: ${tr.output}`);
          }
        },
      });

      let fullResponse = "";
      for await (const delta of result.textStream) {
        fullResponse += delta;
      }

      if (fullResponse) {
        console.log("\n Response: " + fullResponse);
      }

      messages.push({ role: "assistant", content: fullResponse });

      console.log("-------------------");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    rl.close();
  }
}

/**
 * Runs autonomous mode on an interval.
 *
 * @param tools - Vercel AI SDK tools.
 * @param interval - Seconds between autonomous steps.
 */
async function runAutonomousMode(tools: ToolSet, interval = 10) {
  console.log("Starting autonomous mode...");

  const messages: Parameters<typeof streamText>[0]["messages"] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const thought =
        "Be creative and do something interesting on the blockchain. " +
        "Choose an action or set of actions and execute it that highlights your abilities.";

      messages.push({ role: "user", content: thought });

      const result = streamText({
        model: openai.chat("gpt-4o-mini"),
        messages,
        tools,
        system: `${system}\n\n${signingInstructions}`,
        stopWhen: stepCountIs(10),
        onStepFinish: async ({ toolResults }) => {
          for (const tr of toolResults) {
            console.log(`Tool ${tr.toolName}: ${tr.output}`);
          }
        },
      });

      let fullResponse = "";
      for await (const delta of result.textStream) {
        fullResponse += delta;
      }

      if (fullResponse) {
        console.log("\n Response: " + fullResponse);
      }

      messages.push({ role: "assistant", content: fullResponse });

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
 * Prompts user to choose chat or autonomous mode.
 *
 * @returns Selected execution mode.
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
 * Main entry point.
 */
async function main() {
  try {
    const { tools } = await initializeAgent();
    const mode = await chooseMode();

    if (mode === "chat") {
      await runChatMode(tools);
    } else {
      await runAutonomousMode(tools);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  console.log("Starting WaaP Agent...");
  main().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
