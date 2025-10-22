import {
  ActionProvider,
  AgentKit,
  cdpApiActionProvider,
  erc20ActionProvider,
  NETWORK_ID_TO_VIEM_CHAIN,
  pythActionProvider,
  ViemWalletProvider,
  walletActionProvider,
  wethActionProvider,
} from "@coinbase/agentkit";
import { createWalletClient, Hex, http } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/**
 * Get the AgentKit instance.
 *
 * @returns {Promise<AgentKit>} The AgentKit instance
 */
export async function getAgentKit(): Promise<AgentKit> {
  try {
    // Initialize WalletProvider: https://docs.cdp.coinbase.com/agentkit/docs/wallet-management
    let privateKey = process.env.PRIVATE_KEY as Hex;
    if (!privateKey) {
      privateKey = generatePrivateKey();
    }

    const account = privateKeyToAccount(privateKey);
    const networkId = process.env.NETWORK_ID as string;

    const client = createWalletClient({
      account,
      chain: NETWORK_ID_TO_VIEM_CHAIN[networkId],
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
