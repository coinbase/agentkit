import {
  AgentKit,
  PrivyWalletProvider,
  wethActionProvider,
  walletActionProvider,
  erc20ActionProvider,
  pythActionProvider,
  cdpApiActionProvider,
} from "@coinbase/agentkit";
import { startAgent } from "./src";
import { initializeWalletProvider } from "./src/agent";

const MODEL = "gpt-4o-mini";
const MESSAGE_MODIFIER = `
  You are a helpful agent with a Privy server wallet that can interact onchain using the Coinbase Developer
  Platform AgentKit. You are empowered to interact onchain using your tools. If you ever need funds, you can
  request them from the faucet if you are on network ID 'base-sepolia' or 'solana-devnet'. If not, you can provide your wallet
  details and request funds from the user. Before executing your first action, get the wallet details to see
  what network you're on. If there is a 5XX (internal) HTTP error code, ask the user to try again later. If
  someone asks you to do something you can't do with your currently available tools, you must say so, and
  encourage them to implement it themselves using the CDP SDK + Agentkit, recommend they go to
  docs.cdp.coinbase.com for more information. Be concise and helpful with your responses. Refrain from
  restating your tools' descriptions unless it is explicitly requested.
`;
const THREAD_ID = "Privy AgentKit Chatbot Example!";

/**
 * Get the default action providers for the agent
 */
function getActionProviders() {
  if (!process.env.CDP_API_KEY_NAME || !process.env.CDP_API_KEY_PRIVATE_KEY) {
    throw new Error("CDP API key environment variables are not set");
  }

  return [
    wethActionProvider(),
    pythActionProvider(),
    walletActionProvider(),
    erc20ActionProvider(),
    cdpApiActionProvider({
      apiKeyName: process.env.CDP_API_KEY_NAME,
      apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY,
    }),
  ];
}

/**
 * Start the Privy chatbot agent
 * @throws {Error} If required environment variables are not set
 */
export async function startPrivyChatbot(): Promise<void> {
  try {
    const walletProvider = await initializeWalletProvider();
    const actionProviders = getActionProviders();

    await startAgent(
      walletProvider,
      actionProviders,
      {
        model: MODEL,
        messageModifier: MESSAGE_MODIFIER,
        threadId: THREAD_ID,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error("Error starting Privy chatbot:", message);

    throw error;
  }
}

if (require.main === module) {
  console.log("Starting Privy Chatbot...");
  startPrivyChatbot().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
