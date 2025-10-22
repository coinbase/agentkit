import {
  ActionProvider,
  AgentKit,
  cdpApiActionProvider,
  erc20ActionProvider,
  PrivyWalletConfig,
  PrivyWalletProvider,
  pythActionProvider,
  walletActionProvider,
  wethActionProvider,
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
      chainId: process.env.CHAIN_ID,
      authorizationPrivateKey: process.env.PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY,
      authorizationKeyId: process.env.PRIVY_WALLET_AUTHORIZATION_KEY_ID,
    };

    if (!config.chainId) {
      console.log("Warning: CHAIN_ID not set, defaulting to 84532 (base-sepolia)");
      config.chainId = "84532";
    }
    const walletProvider = await PrivyWalletProvider.configureWithWallet(config);

    // Initialize AgentKit: https://docs.cdp.coinbase.com/agentkit/docs/agent-actions
    const actionProviders: ActionProvider[] = [
      wethActionProvider(),
      pythActionProvider(),
      walletActionProvider(),
      erc20ActionProvider(),
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
