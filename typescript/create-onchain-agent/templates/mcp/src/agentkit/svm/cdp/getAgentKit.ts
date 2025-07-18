import {
  AgentKit,
  cdpApiActionProvider,
  CdpSolanaWalletProvider,
  jupiterActionProvider,
  splActionProvider,
  walletActionProvider,
} from "@coinbase/agentkit";

/**
 * Get the AgentKit instance.
 *
 * @returns {Promise<AgentKit>} The AgentKit instance
 */
export async function getAgentKit(): Promise<AgentKit> {
  try {
    // Initialize WalletProvider: https://docs.cdp.coinbase.com/agentkit/docs/wallet-management
    const walletProvider = await CdpSolanaWalletProvider.configureWithWallet({
      apiKeyId: process.env.CDP_API_KEY_ID,
      apiKeySecret: process.env.CDP_API_KEY_SECRET,
      walletSecret: process.env.CDP_WALLET_SECRET,
      networkId: process.env.NETWORK_ID || "solana-devnet",
    });

    // Initialize AgentKit: https://docs.cdp.coinbase.com/agentkit/docs/agent-actions
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        walletActionProvider(),
        splActionProvider(),
        jupiterActionProvider(),
        cdpApiActionProvider(),
      ],
    });

    return agentkit;
  } catch (error) {
    console.error("Error initializing agent:", error);
    throw new Error("Failed to initialize agent");
  }
}
