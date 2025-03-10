import {
  ActionProvider,
  AgentKit,
  cdpApiActionProvider,
  jupiterActionProvider,
  PrivyWalletConfig,
  PrivyWalletProvider,
  splActionProvider,
  walletActionProvider,
  WalletProvider,
} from "@coinbase/agentkit";
import fs from "fs";

/**
 * AgentKit Integration Route
 *
 * This file is your gateway to integrating AgentKit with your product.
 * It defines the interaction between your system and the AI agent,
 * allowing you to configure the agent to suit your needs.
 *
 * # Key Steps to Customize Your Agent:**
 *
 * 1. Select your LLM:
 *    - Modify the `ChatOpenAI` instantiation to choose your preferred LLM.
 *
 * 2. Set up your WalletProvider:
 *    - Learn more: https://github.com/coinbase/agentkit/tree/main/typescript/agentkit#evm-wallet-providers
 *
 * 3️. Set up your ActionProviders:
 *    - ActionProviders define what your agent can do.
 *    - Choose from built-in providers or create your own:
 *      - Built-in: https://github.com/coinbase/agentkit/tree/main/typescript/agentkit#action-providers
 *      - Custom: https://github.com/coinbase/agentkit/tree/main/typescript/agentkit#creating-an-action-provider
 *
 * 4. Instantiate your Agent:
 *    - Pass the LLM, tools, and memory into `createReactAgent()` to bring your agent to life.
 *
 * # Next Steps:
 * - Explore the AgentKit README: https://github.com/coinbase/agentkit
 * - Learn more about available WalletProviders & ActionProviders.
 * - Experiment with custom ActionProviders for your unique use case.
 *
 * ## Want to contribute?
 * Join us in shaping AgentKit! Check out the contribution guide:
 * - https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING.md
 * - https://discord.gg/CDP
 */

// Configure a file to persist the agent's Prviy Wallet Data
const WALLET_DATA_FILE = "wallet_data.txt";

/**
 * Prepares the AgentKit and WalletProvider.
 *
 * @function prepareAgentkitAndWalletProvider
 * @returns {Promise<{ agentkit: AgentKit, walletProvider: WalletProvider }>} The initialized AI agent.
 *
 * @description Handles agent setup
 *
 * @throws {Error} If the agent initialization fails.
 */
export async function prepareAgentkitAndWalletProvider(): Promise<{ agentkit: AgentKit, walletProvider: WalletProvider }> {
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
    // Try to load saved wallet data
    if (fs.existsSync(WALLET_DATA_FILE)) {
      const savedWallet = JSON.parse(fs.readFileSync(WALLET_DATA_FILE, "utf8"));
      config.walletId = savedWallet.walletId;
      config.authorizationPrivateKey = savedWallet.authorizationPrivateKey;
      config.networkId = savedWallet.networkId;
    }
    const walletProvider = await PrivyWalletProvider.configureWithWallet(config);

    // Initialize AgentKit: https://docs.cdp.coinbase.com/agentkit/docs/agent-actions
    const actionProviders: ActionProvider[] = [
      walletActionProvider(),
      splActionProvider(),
      jupiterActionProvider(),
    ];
    const canUseCdpApi = process.env.CDP_API_KEY_NAME && process.env.CDP_API_KEY_PRIVATE_KEY;
    if (canUseCdpApi) {
      actionProviders.push(
        cdpApiActionProvider({
          apiKeyName: process.env.CDP_API_KEY_NAME,
          apiKeyPrivateKey: process.env.CDP_API_KEY_PRIVATE_KEY,
        }),
      );
    }
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders,
    });

    // Save wallet data
    const exportedWallet = walletProvider.exportWallet();
    fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify(exportedWallet));

    return { agentkit, walletProvider };
  } catch (error) {
    console.error("Error initializing agent:", error);
    throw new Error("Failed to initialize agent");
  }
}
