import { ZeroDevWalletProvider } from "../../wallet-providers";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { GetCABSchema } from "./schemas";
import { z } from "zod";

/**
 * ZeroDevWalletActionProvider is an action provider for ZeroDevWalletProvider.
 *
 * This provider is used for any action that requires a ZeroDevWalletProvider.
 */
export class ZeroDevWalletActionProvider extends ActionProvider<ZeroDevWalletProvider> {
  /**
   * Constructs a new ZeroDevWalletActionProvider.
   */
  constructor() {
    super("zeroDevWallet", []);
  }

  /**
   * Gets the chain abstracted balance for the wallet.
   *
   * @param walletProvider - The wallet provider to get the balance for.
   * @param args - The arguments for the action.
   * @returns The chain abstracted balance for the wallet.
   */
  @CreateAction({
    name: "get_cab",
    description: `This tool retrieves the chain abstracted balance (CAB) for specified tokens across multiple networks. 
It takes the following inputs:
- tokenTickers: An array of token symbols (e.g., ["ETH", "USDC"]) to get balances for
- networks (optional): An array of network IDs to check balances on. If not provided, will check all supported networks
- networkType (optional): Filter networks by type ("mainnet" or "testnet"). If not provided, will check both types

The tool will return the aggregated balance across all specified networks for each token ticker. This is useful for getting a complete picture of a wallet's holdings across different chains in a single call.`,
    schema: GetCABSchema,
  })
  async getCAB(walletProvider: ZeroDevWalletProvider, args: z.infer<typeof GetCABSchema>) {
    return walletProvider.getCAB(args);
  }

  /**
   * Checks if the ZeroDevWalletActionProvider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the ZeroDevWalletActionProvider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) => network.protocolFamily === "evm";
}

export const zeroDevWalletActionProvider = () => new ZeroDevWalletActionProvider();
