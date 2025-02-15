import { z } from "zod";

import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { WalletProvider } from "../../wallet-providers";
import { Network } from "../../network";

import { NativeTransferSchema, GetWalletDetailsSchema } from "./schemas";

const PROTOCOL_FAMILY_TO_TERMINOLOGY: Record<
  string,
  { unit: string; displayUnit: string; type: string; verb: string }
> = {
  evm: { unit: "WEI", displayUnit: "ETH", type: "Transaction hash", verb: "transaction" },
  svm: { unit: "LAMPORTS", displayUnit: "SOL", type: "Signature", verb: "transfer" },
};

const DEFAULT_TERMINOLOGY = { unit: "", displayUnit: "", type: "Hash", verb: "transfer" };

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
    - Native token balance (ETH for EVM networks, SOL for Solana networks)
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
      const terminology =
        PROTOCOL_FAMILY_TO_TERMINOLOGY[network.protocolFamily] || DEFAULT_TERMINOLOGY;

      return [
        "Wallet Details:",
        `- Provider: ${name}`,
        `- Address: ${address}`,
        "- Network:",
        `  * Protocol Family: ${network.protocolFamily}`,
        `  * Network ID: ${network.networkId || "N/A"}`,
        `  * Chain ID: ${network.chainId || "N/A"}`,
        `- Native Balance: ${balance.toString()} ${terminology.unit}`,
      ].join("\n");
    } catch (error) {
      return `Error getting wallet details: ${error}`;
    }
  }

  /**
   * Transfers a specified amount of native currency to a destination onchain.
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
- amount: The amount to transfer in whole units (e.g. 1 ETH, 0.1 SOL)
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
      const { protocolFamily } = walletProvider.getNetwork();
      const terminology = PROTOCOL_FAMILY_TO_TERMINOLOGY[protocolFamily] || DEFAULT_TERMINOLOGY;

      if (protocolFamily === "evm" && !args.to.startsWith("0x")) {
        args.to = `0x${args.to}`;
      }

      const result = await walletProvider.nativeTransfer(args.to, args.value);
      return [
        `Transferred ${args.value} ${terminology.displayUnit} to ${args.to}`,
        `${terminology.type}: ${result}`,
      ].join("\n");
    } catch (error) {
      const { protocolFamily } = walletProvider.getNetwork();
      const terminology = PROTOCOL_FAMILY_TO_TERMINOLOGY[protocolFamily] || DEFAULT_TERMINOLOGY;
      return `Error during ${terminology.verb}: ${error}`;
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
