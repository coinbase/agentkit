/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  AgentKit,
  CdpWalletProvider,
  wethActionProvider,
  walletActionProvider,
  erc20ActionProvider,
  cdpApiActionProvider,
  cdpWalletActionProvider,
  pythActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import * as fs from "fs";
import * as readline from "readline";

const OPENAI_API_KEY=process.env.NEXT_PUBLIC_OPENAI_API_KEY
/**
* Validates that required environment variables are set
*
* @throws {Error} - If required environment variables are missing
* @returns {void}
*/
function validateEnvironment(): void {
  const missingVars: string[] = [];

  // Check required variables
  const requiredVars = ["NEXT_PUBLIC_OPENAI_API_KEY", "NEXT_PUBLIC_CDP_API_KEY_NAME", "NEXT_PUBLIC_CDP_API_KEY_PRIVATE_KEY"];
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
  if (!process.env.NEXT_PUBLIC_NETWORK_ID) {
      console.warn("Warning: NETWORK_ID not set, defaulting to base-sepolia testnet");
  }
}

// Add this right after imports and before any other code
validateEnvironment();

// Configure a file to persist the agent's CDP MPC Wallet Data
const WALLET_DATA_FILE = "wallet_data.txt";

/**
* Initialize the agent with CDP Agentkit
*
* @returns Agent executor and config
*/
export async function initializeAgent() {
  try {

      // Initialize LLM
 const llm = new ChatOpenAI({
      apiKey: OPENAI_API_KEY,
      model: "gpt-4o-mini",
      temperature: 0.7,
      maxTokens: 2048
  });

      // Read existing wallet data if available
      let walletDataStr;
      try {
          if (fs.existsSync(WALLET_DATA_FILE)) {
              walletDataStr = fs.readFileSync(WALLET_DATA_FILE, 'utf8');
          }
      } catch (error) {
          console.warn('Could not read wallet data file:', error);
      }

      // Configure CDP Wallet Provider
      const config = {
          apiKeyName: process.env.NEXT_PUBLIC_CDP_API_KEY_NAME,
          apiKeyPrivateKey: process.env.NEXT_PUBLIC_CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
          cdpWalletData: walletDataStr || undefined,
          networkId: process.env.NEXT_PUBLIC_NETWORK_ID || "base-sepolia",
      };

      const walletProvider = await CdpWalletProvider.configureWithWallet(config);

      // Initialize AgentKit
      const agentkit = await AgentKit.from({
          walletProvider,
          actionProviders: [
              wethActionProvider(),
              pythActionProvider(),
              walletActionProvider(),
              erc20ActionProvider(),
              cdpApiActionProvider({
                  apiKeyName: process.env.NEXT_PUBLIC_CDP_API_KEY_NAME,
                  apiKeyPrivateKey: process.env.NEXT_PUBLIC_CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
              }),
              cdpWalletActionProvider({
                  apiKeyName: process.env.NEXT_PUBLIC_CDP_API_KEY_NAME,
                  apiKeyPrivateKey: process.env.NEXT_PUBLIC_CDP_API_KEY_PRIVATE_KEY?.replace(/\\n/g, "\n"),
              }),
          ],
      });


      const tools = await getLangChainTools(agentkit);
  
      // Store buffered conversation history in memory
      const memory = new MemorySaver();
      const agentConfig = { configurable: { thread_id: "CDP AgentKit Chatbot Example!" } };

      // Create React Agent using the LLM and CDP AgentKit tools
      const agent = createReactAgent({
          llm,
          tools,
          checkpointSaver: memory,
          messageModifier: `
        You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit. You are 
        empowered to interact onchain using your tools. If you ever need funds, you can request them from the 
        faucet if you are on network ID 'base-sepolia'. If not, you can provide your wallet details and request 
        funds from the user. Before executing your first action, get the wallet details to see what network 
        you're on. If there is a 5XX (internal) HTTP error code, ask the user to try again later. If someone 
        asks you to do something you can't do with your currently available tools, you must say so, and 
        encourage them to implement it themselves using the CDP SDK + Agentkit, recommend they go to 
        docs.cdp.coinbase.com for more information. Be concise and helpful with your responses. Refrain from 
        restating your tools' descriptions unless it is explicitly requested.
        If a user wants you to help them with dollar cost averaging (DCA), you can assist with that. 
        You have access to wallet balances, ERC20 token transfers, and price data. When someone asks 
        about DCA, first check their wallet balance, then calculate the optimal token amount to buy 
        based on their specified frequency and total investment amount. Remember to:
        1. Verify sufficient funds before each trade
        2. Track donor addresses and their investment parameters
        3. Use Pyth price feeds for accurate pricing
        4. Execute ERC20 transfers back to original donor addresses
        5. Only trade on supported DEXs and with allowed tokens
        6. Keep detailed records of all transactions for each donor
        Make sure to inform users about gas fees and recommend appropriate DCA intervals to minimize costs.
        `,
      });

      // Save wallet data
      const exportedWallet = await walletProvider.exportWallet();
      fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(exportedWallet));

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
  //
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
