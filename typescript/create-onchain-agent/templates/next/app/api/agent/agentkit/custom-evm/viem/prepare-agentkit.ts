import {
  ActionProvider,
  AgentKit,
  cdpApiActionProvider,
  erc20ActionProvider,
  pythActionProvider,
  ViemWalletProvider,
  walletActionProvider,
  WalletProvider,
  wethActionProvider,
} from "@coinbase/agentkit";
import fs from "fs";
import { createWalletClient, http } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

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

// Configure a file to persist a user's private key if none provided
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
    let privateKey = process.env.PRIVATE_KEY as `0x${string}`;
    if (!privateKey) {
      if (fs.existsSync(WALLET_DATA_FILE)) {
        privateKey = JSON.parse(fs.readFileSync(WALLET_DATA_FILE, "utf8")).privateKey;
        console.info("Found private key in wallet_data.txt");
      } else {
        privateKey = generatePrivateKey();
        fs.writeFileSync(WALLET_DATA_FILE, JSON.stringify({ privateKey }));
        console.log("Created new private key and saved to wallet_data.txt");
        console.log(
          "We recommend you save this private key to your .env file and delete wallet_data.txt afterwards.",
        );
      }
    }
    const account = privateKeyToAccount(privateKey);

    const rpcUrl = process.env.RPC_URL as string;
    const chainId = process.env.CHAIN_ID as string;
    const client = createWalletClient({
      account,
      // Customize the chain metadata to match your custom chain
      chain: {
        id: parseInt(chainId),
        rpcUrls: {
          default: {
            http: [rpcUrl],
          },
        },
        name: "Custom Chain",
        nativeCurrency: {
          name: "Ether",
          symbol: "ETH",
          decimals: 18,
        },
      },
      transport: http(),
    });
    const walletProvider = new ViemWalletProvider(client);

    // Initialize AgentKit: https://docs.cdp.coinbase.com/agentkit/docs/agent-actions
    const actionProviders: ActionProvider[] = [
      wethActionProvider(),
      pythActionProvider(),
      walletActionProvider(),
      erc20ActionProvider(),
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

    return { agentkit, walletProvider };
  } catch (error) {
    console.error("Error initializing agent:", error);
    throw new Error("Failed to initialize agent");
  }
}
