import {
  ActionProvider,
  AgentKit,
  cdpApiActionProvider,
  jupiterActionProvider,
  SOLANA_NETWORK_ID,
  SolanaKeypairWalletProvider,
  splActionProvider,
  walletActionProvider,
} from "@coinbase/agentkit";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

/**
 * Get the AgentKit instance.
 *
 * @returns {Promise<AgentKit>} The AgentKit instance
 */
export async function getAgentKit(): Promise<AgentKit> {
  try {
    // Setup Private Key
    let privateKey = process.env.SOLANA_PRIVATE_KEY as string;
    if (!privateKey) {
      const keypair = Keypair.generate();
      privateKey = bs58.encode(keypair.secretKey);
    }

    // Initialize WalletProvider: https://docs.cdp.coinbase.com/agentkit/docs/wallet-management
    // Configure Solana Keypair Wallet Provider
    const rpcUrl = process.env.SOLANA_RPC_URL;
    let walletProvider: SolanaKeypairWalletProvider;
    if (rpcUrl) {
      walletProvider = await SolanaKeypairWalletProvider.fromRpcUrl(rpcUrl, privateKey);
    } else {
      const network = (process.env.NETWORK_ID ?? "solana-devnet") as SOLANA_NETWORK_ID;
      walletProvider = await SolanaKeypairWalletProvider.fromNetwork(network, privateKey);
    }

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
