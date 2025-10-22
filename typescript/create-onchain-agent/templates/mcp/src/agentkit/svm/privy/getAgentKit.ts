import {
  ActionProvider,
  AgentKit,
  cdpApiActionProvider,
  jupiterActionProvider,
  PrivyWalletConfig,
  PrivyWalletProvider,
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
    const config: PrivyWalletConfig = {
      appId: process.env.PRIVY_APP_ID as string,
      appSecret: process.env.PRIVY_APP_SECRET as string,
      walletId: process.env.PRIVY_WALLET_ID as string,
      authorizationPrivateKey: process.env.PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY,
      authorizationKeyId: process.env.PRIVY_WALLET_AUTHORIZATION_KEY_ID,
      chainType: "solana",
      networkId: process.env.NETWORK_ID,
    };

    const walletProvider = await PrivyWalletProvider.configureWithWallet(config);

    // Initialize AgentKit: https://docs.cdp.coinbase.com/agentkit/docs/agent-actions
    const actionProviders: ActionProvider[] = [
      walletActionProvider(),
      splActionProvider(),
      jupiterActionProvider(),
    ];
    const canUseCdpApi = process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET;
    if (canUseCdpApi) {
      actionProviders.push(
        cdpApiActionProvider({
          apiKeyId: process.env.CDP_API_KEY_ID,
          apiKeySecret: process.env.CDP_API_KEY_SECRET,
        }),
      );
    }
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders,
    });

    return agentkit;
  } catch (error) {
    console.error("Error initializing agent:", error);
    throw new Error("Failed to initialize agent");
  }
}
