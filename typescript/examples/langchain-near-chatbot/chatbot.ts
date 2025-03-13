import {
  AgentKit,
  walletActionProvider,
  NearKeypairWalletProvider,
  nearActionProvider,
  NEAR_NETWORK_ID, NEAR_TESTNET_NETWORK_ID, NEAR_MAINNET_NETWORK_ID
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";

import { UnencryptedFileSystemKeyStore } from '@near-js/keystores-node';
import { KeyPair } from '@near-js/crypto';

import { join } from 'node:path';
import * as dotenv from "dotenv";
import * as readline from "readline";

import { chooseAccount, createFundedTestnetAccount, getEndpointsByNetworkId } from "./chatbot-utils";

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
  const requiredVars = ["OPENAI_API_KEY"];
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
    console.warn(
      "Warning: NETWORK_ID both is unset, defaulting to near-testnet",
    );
  }

  const networkId = process.env.NETWORK_ID || NEAR_TESTNET_NETWORK_ID;
  if (networkId !== NEAR_TESTNET_NETWORK_ID && networkId !== NEAR_MAINNET_NETWORK_ID) {
    console.error(`Error: NETWORK_ID must be one of ${NEAR_TESTNET_NETWORK_ID} or ${NEAR_MAINNET_NETWORK_ID}`);
    process.exit(1);
  }

  if (networkId === NEAR_MAINNET_NETWORK_ID) {
    // On mainnet, we need to have the NEAR_ACCOUNT_ID and  NEAR_PRIVATE_KEY set
    if (!process.env.NEAR_PRIVATE_KEY) {
      console.error("Error: NEAR_PRIVATE_KEY is required on mainnet");
      process.exit(1);
    }

    if (!process.env.NEAR_ACCOUNT_ID) {
      console.error("Error: NEAR_ACCOUNT_ID is required on mainnet");
      process.exit(1);
    }
  } else {
    // Check optional dependant variables NEAR_PRIVATE_KEY without NEAR_ACCOUNT_ID
    if (process.env.NEAR_PRIVATE_KEY && !process.env.NEAR_ACCOUNT_ID) {
      console.error("Error: NEAR_ACCOUNT_ID is required when NEAR_PRIVATE_KEY is set");
      process.exit(1);
    }

    // Check optional dependant variables NEAR_ACCOUNT_ID without NEAR_PRIVATE_KEY
    if (process.env.NEAR_ACCOUNT_ID && !process.env.NEAR_PRIVATE_KEY) {
      console.warn(`Warning: NEAR_ACCOUNT_ID is set without NEAR_PRIVATE_KEY, the private key will be loaded from the keystore using the provided NEAR_ACCOUNT_ID`);
    }

    // Warn about optional NEAR_ACCOUNT_ID & NEAR_PRIVATE_KEY
    if (!process.env.NEAR_ACCOUNT_ID && !process.env.NEAR_PRIVATE_KEY) {
      console.warn("Warning: NEAR_ACCOUNT_ID and NEAR_PRIVATE_KEY are unset, you will be prompted to create an account");
    }
  }
}

// Add this right after imports and before any other code
validateEnvironment();

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

    const network = (process.env.NETWORK_ID || NEAR_TESTNET_NETWORK_ID) as NEAR_NETWORK_ID;
    let nearPrivateKey = process.env.NEAR_PRIVATE_KEY as string;
    let accountId = process.env.NEAR_ACCOUNT_ID as string;
    let rpcProviderUrl = getEndpointsByNetworkId(network);

    let walletProvider;

    if (network === NEAR_MAINNET_NETWORK_ID) {
      const keyPair = KeyPair.fromString(nearPrivateKey);
      walletProvider = new NearKeypairWalletProvider(keyPair, accountId, rpcProviderUrl, network);
    }


    if (network === NEAR_TESTNET_NETWORK_ID) {
      if (nearPrivateKey && accountId) {
        const keyPair = KeyPair.fromString(nearPrivateKey);
        walletProvider = new NearKeypairWalletProvider(keyPair, accountId, rpcProviderUrl, network);
      }

      if (accountId && !nearPrivateKey) {
        const keystore = new UnencryptedFileSystemKeyStore(join(process.cwd(), '.near-credentials'));
        const keypair = await keystore.getKey(network, accountId);
        walletProvider = new NearKeypairWalletProvider(keypair, accountId, rpcProviderUrl, network);
      }

      if (!accountId && !nearPrivateKey) {
        console.log(`No NEAR account detected. Creating an account...`);
        const accountId = await chooseAccount();
        const keyPair = KeyPair.fromRandom('ed25519'); // Generate a new keypair

        const keystore = new UnencryptedFileSystemKeyStore(join(process.cwd(), '.near-credentials'));
        await keystore.setKey('testnet', accountId, keyPair);

        await createFundedTestnetAccount(
          accountId,
          keyPair.getPublicKey().toString()
        );

        console.log(`✅ Account created: ${accountId}`);

        walletProvider = new NearKeypairWalletProvider(keyPair, accountId, rpcProviderUrl, network);
      }
    }

    if (!walletProvider) {
      console.error("Failed to initialize wallet provider");
      process.exit(1);
    }

    // Initialize AgentKit
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [nearActionProvider(), walletActionProvider()],
    });

    const tools = await getLangChainTools(agentkit);

    // Store buffered conversation history in memory
    const memory = new MemorySaver();
    const agentConfig = { configurable: { thread_id: "NEAR AgentKit Chatbot Example!" } };

    // Create React Agent using the LLM and NEAR AgentKit tools
    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: `
        You are a helpful agent that can interact across chains using NEAR chain signatures and the Coinbase Developer Platform AgentKit. 
        You are empowered to interact across chains using your tools. Before executing your first action, get the wallet details to see what network 
        you're on. If there is a 5XX (internal) HTTP error code, ask the user to try again later. 
        If someone asks you to do something you can't do with your currently available tools, you must say so, and 
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
        if ("agent" in chunk) {
          console.log(chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
          console.log(chunk.tools.messages[0].content);
        }
        console.log("-------------------");
      }

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

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const userInput = await question("\nPrompt: ");

      if (userInput.toLowerCase() === "exit") {
        break;
      }

      const stream = await agent.stream({ messages: [new HumanMessage(userInput)] }, config);

      for await (const chunk of stream) {
        if ("agent" in chunk) {
          console.log(chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
          console.log(chunk.tools.messages[0].content);
        }
        console.log("-------------------");
      }
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
