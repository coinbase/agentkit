import {
  AgentKit,
  cdpApiActionProvider,
  erc20ActionProvider,
  pythActionProvider,
  SmartWalletProvider,
  walletActionProvider,
  wethActionProvider,
} from "@coinbase/agentkit";
import { Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

/**
 * Get the AgentKit instance.
 *
 * @returns {Promise<AgentKit>} The AgentKit instance
 */
export async function getAgentKit(): Promise<AgentKit> {
  try {
    let privateKey: Hex | null = null;

    if (!privateKey) {
      privateKey = (process.env.PRIVATE_KEY || generatePrivateKey()) as Hex;
    }

    const signer = privateKeyToAccount(privateKey);

    // Initialize WalletProvider: https://docs.cdp.coinbase.com/agentkit/docs/wallet-management
    const walletProvider = await SmartWalletProvider.configureWithWallet({
      networkId: process.env.NETWORK_ID || "base-sepolia",
      signer,
      paymasterUrl: undefined, // Sponsor transactions: https://docs.cdp.coinbase.com/paymaster/docs/welcome
    });

    // Initialize AgentKit: https://docs.cdp.coinbase.com/agentkit/docs/agent-actions
    const agentkit = await AgentKit.from({
      walletProvider,
      actionProviders: [
        wethActionProvider(),
        pythActionProvider(),
        walletActionProvider(),
        erc20ActionProvider(),
        cdpApiActionProvider({
          apiKeyId: process.env.CDP_API_KEY_ID,
          apiKeySecret: process.env.CDP_API_KEY_SECRET,
        }),
      ],
    });

    return agentkit;
  } catch (error) {
    console.error("Error initializing agent:", error);
    throw new Error("Failed to initialize agent");
  }
}
