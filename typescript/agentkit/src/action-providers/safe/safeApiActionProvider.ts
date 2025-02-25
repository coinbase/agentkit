import { z } from "zod";
import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { SafeInfoSchema } from "./schemas";
import { Network, NETWORK_ID_TO_VIEM_CHAIN } from "../../network";

import { Chain, formatEther } from "viem";
import SafeApiKit from "@safe-global/api-kit";

/**
 * Configuration options for the SafeActionProvider.
 */
export interface SafeApiActionProviderConfig {
  /**
   * The network ID to use for the SafeActionProvider.
   */
  networkId?: string;
}

/**
 * SafeApiActionProvider is an action provider for Safe.
 *
 * This provider is used for any action that uses the Safe API, but does not require a Safe Wallet.
 */
export class SafeApiActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly chain: Chain;
  private apiKit: SafeApiKit;

  /**
   * Constructor for the SafeActionProvider class.
   *
   * @param config - The configuration options for the SafeActionProvider.
   */
  constructor(config: SafeApiActionProviderConfig = {}) {
    super("safe", []);

    // Initialize chain
    this.chain = NETWORK_ID_TO_VIEM_CHAIN[config.networkId || "base-sepolia"];
    if (!this.chain) throw new Error(`Unsupported network: ${config.networkId}`);

    // Initialize apiKit with chain ID from Viem chain
    this.apiKit = new SafeApiKit({
      chainId: BigInt(this.chain.id),
    });
  }

  /**
   * Connects to an existing Safe smart account.
   *
   * @param walletProvider - The wallet provider to use for the action.
   * @param args - The input arguments for connecting to a Safe.
   * @returns A message containing the connection details.
   */
  @CreateAction({
    name: "safe_info",
    description: `
Gets information about an existing Safe smart account.
Takes the following input:
- safeAddress: Address of the existing Safe to connect to

Important notes:
- The Safe must already be deployed
`,
    schema: SafeInfoSchema,
  })
  async safeInfo(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SafeInfoSchema>,
  ): Promise<string> {
    try {
      // Get Safe info
      console.log("Getting Safe info for address:", args.safeAddress);
      const safeInfo = await this.apiKit.getSafeInfo(args.safeAddress);
      console.log("Safe info:", safeInfo);

      const owners = safeInfo.owners;
      const threshold = safeInfo.threshold;
      const modules = safeInfo.modules;
      const nonce = safeInfo.nonce;

      // Get balance
      const ethBalance = formatEther(
        await walletProvider.getPublicClient().getBalance({ address: args.safeAddress }),
      );

      // Get pending transactions
      const pendingTransactions = await this.apiKit.getPendingTransactions(args.safeAddress);
      const pendingTxDetails = pendingTransactions.results
        .filter(tx => !tx.isExecuted)
        .map(tx => {
          const confirmations = tx.confirmations?.length || 0;
          const needed = tx.confirmationsRequired;
          const confirmedBy = tx.confirmations?.map(c => c.owner).join(", ") || "none";
          return `\n- Transaction ${tx.safeTxHash} (${confirmations}/${needed} confirmations, confirmed by: ${confirmedBy})`;
        })
        .join("");

      return `Safe info:
- Safe at address: ${args.safeAddress}
- Chain: ${this.chain.name}
- ${owners.length} owners: ${owners.join(", ")}
- Threshold: ${threshold}
- Nonce: ${nonce}
- Modules: ${modules.join(", ")}
- Balance: ${ethBalance} ETH
- Pending transactions: ${pendingTransactions.count}${pendingTxDetails}`;
    } catch (error) {
      return `Safe info: Error connecting to Safe: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Checks if the Safe action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Safe action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) => network.protocolFamily === "evm";
}

export const safeApiActionProvider = (config: SafeApiActionProviderConfig = {}) =>
  new SafeApiActionProvider(config);
