import {
  AgentKit,
  PrivyWalletProvider,
  wethActionProvider,
  walletActionProvider,
  erc20ActionProvider,
  pythActionProvider,
  PrivyEvmWalletProvider,
  PrivySvmWalletProvider,
  cdpApiActionProvider,
} from "@coinbase/agentkit";
import { getLangChainTools } from "@coinbase/agentkit-langchain";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { loadSavedWalletData, createEthereumConfig, createSolanaConfig, saveWalletData } from "./config";

export async function initializeWalletProvider(): Promise<PrivyEvmWalletProvider | PrivySvmWalletProvider> {
  let walletProvider: PrivyEvmWalletProvider | PrivySvmWalletProvider;
  const networkId = process.env.NETWORK_ID;
  const savedWallet = loadSavedWalletData();

  const config = networkId?.includes("solana") ?
    createSolanaConfig(networkId, savedWallet) :
    createEthereumConfig(savedWallet);

  walletProvider = await PrivyWalletProvider.configureWithWallet(config);
  const exportedWallet = walletProvider.exportWallet();

  if (savedWallet && savedWallet.walletId !== exportedWallet.walletId) {
    throw new Error(`Wallet ID mismatch. Expected ${savedWallet.walletId} but got ${exportedWallet.walletId}`);
  }

  if (!savedWallet) {
    saveWalletData(exportedWallet);
  }

  return walletProvider;
}

export async function createAgent() {
  try {
    // Initialize LLM
    const llm = new ChatOpenAI({
      model: "gpt-4o-mini",
    });

    const walletProvider = await initializeWalletProvider();

    // Initialize AgentKit
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        wethActionProvider(),
        pythActionProvider(),
        walletActionProvider(),
        erc20ActionProvider(),
        cdpApiActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME as string,
          apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY as string,
        }),
      ],
    });

    const tools = await getLangChainTools(agentkit);
    const memory = new MemorySaver();
    const agentConfig = { configurable: { thread_id: "Privy AgentKit Chatbot Example!" } };

    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier: `
        You are a helpful agent with a Privy server wallet that can interact onchain using the Coinbase Developer
        Platform AgentKit. You are empowered to interact onchain using your tools. If you ever need funds, you can
        request them from the faucet if you are on network ID 'base-sepolia' or 'solana-devnet'. If not, you can provide your wallet
        details and request funds from the user. Before executing your first action, get the wallet details to see
        what network you're on. If there is a 5XX (internal) HTTP error code, ask the user to try again later. If
        someone asks you to do something you can't do with your currently available tools, you must say so, and
        encourage them to implement it themselves using the CDP SDK + Agentkit, recommend they go to
        docs.cdp.coinbase.com for more information. Be concise and helpful with your responses. Refrain from
        restating your tools' descriptions unless it is explicitly requested.
      `,
    });

    return { agent, agentConfig };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
} 