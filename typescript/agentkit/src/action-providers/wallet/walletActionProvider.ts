import { Decimal } from "decimal.js";
import { z } from "zod";

import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { WalletProvider } from "../../wallet-providers";
import { Network } from "../../network";

import { NativeTransferSchema, GetWalletDetailsSchema } from "./schemas";

/**
 * WalletActionProvider provides actions for getting basic wallet information.
 */
export class WalletActionProvider extends ActionProvider {
  /**
   * Constructor for the WalletActionProvider.
   */
  constructor() {
    super("wallet", []);
  }

  /**
   * Gets the details of the connected wallet including address, network, and balance.
   *
   * @param walletProvider - The wallet provider to get the details from.
   * @param _ - Empty args object (not used).
   * @returns A formatted string containing the wallet details.
   */
  @CreateAction({
    name: "get_wallet_details",
    description: `
    This tool will return the details of the connected wallet including:
    - Wallet address
    - Network information (protocol family, network ID, chain ID)
    - ETH token balance
    - Native token balance
    - Wallet provider name
    `,
    schema: GetWalletDetailsSchema,
  })
  async getWalletDetails(
    walletProvider: WalletProvider,
    _: z.infer<typeof GetWalletDetailsSchema>,
  ): Promise<string> {
    try {
      const address = walletProvider.getAddress();
      const network = walletProvider.getNetwork();
      const balance = await walletProvider.getBalance();
      const name = walletProvider.getName();

      // Convert balance from Wei to ETH using Decimal for precision
      const ethBalance = new Decimal(balance.toString()).div(new Decimal(10).pow(18));

      return `Wallet Details:
- Provider: ${name}
- Address: ${address}
- Network: 
  * Protocol Family: ${network.protocolFamily}
  * Network ID: ${network.networkId || "N/A"}
  * Chain ID: ${network.chainId || "N/A"}
- ETH Balance: ${ethBalance.toFixed(6)} ETH
- Native Balance: ${balance.toString()} WEI`;
    } catch (error) {
      return `Error getting wallet details: ${error}`;
    }
  }

  /**
   * Transfers a specified amount of an asset to a destination onchain.
   *
   * @param walletProvider - The wallet provider to transfer from.
   * @param args - The input arguments for the action.
   * @returns A message containing the transfer details.
   */
  @CreateAction({
    name: "native_transfer",
    description: `
This tool will transfer native tokens from the wallet to another onchain address.

It takes the following inputs:
- amount: The amount to transfer in whole units e.g. 1 ETH or 0.00001 ETH
- destination: The address to receive the funds

Important notes:
- Ensure sufficient balance of the input asset before transferring
- Ensure there is sufficient native token balance for gas fees
`,
    schema: NativeTransferSchema,
  })
  async nativeTransfer(
    walletProvider: WalletProvider,
    args: z.infer<typeof NativeTransferSchema>,
  ): Promise<string> {
    try {
      const result = await walletProvider.nativeTransfer(args.to as `0x${string}`, args.value);

      return `Transferred ${args.value} ETH to ${args.to}.\nTransaction hash: ${result}`;
    } catch (error) {
      return `Error transferring the asset: ${error}`;
    }
  }

  /**
   * Checks if the wallet action provider supports the given network.
   * Since wallet actions are network-agnostic, this always returns true.
   *
   * @param _ - The network to check.
   * @returns True, as wallet actions are supported on all networks.
   */
  supportsNetwork = (_: Network): boolean => true;
}

/**
 * Factory function to create a new WalletActionProvider instance.
 *
 * @returns A new WalletActionProvider instance.
 */
export const walletActionProvider = () => new WalletActionProvider();
