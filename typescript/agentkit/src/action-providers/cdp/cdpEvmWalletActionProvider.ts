import { SpendPermissionNetwork } from "@coinbase/cdp-sdk";
import { z } from "zod";
import { WalletProvider } from "../../wallet-providers";
import { isWalletProviderWithClient } from "../../wallet-providers/cdpShared";
import { CdpEvmWalletProvider } from "../../wallet-providers/cdpEvmWalletProvider";
import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { UseSpendPermissionSchema, ListSpendPermissionsSchema } from "./schemas";
import { listSpendPermissionsForSpender, findLatestSpendPermission } from "./spendPermissionUtils";

import type { Network } from "../../network";
import type { Address } from "viem";

/**
 * CdpEvmWalletActionProvider is an action provider for CDP EVM Wallet specific actions.
 *
 * This provider is scoped specifically to EVM wallets and provides actions
 * that are optimized for EVM functionality, including spend permission usage.
 */
export class CdpEvmWalletActionProvider extends ActionProvider<CdpEvmWalletProvider> {
  /**
   * Constructor for the CdpEvmWalletActionProvider class.
   */
  constructor() {
    super("cdp_evm_wallet", []);
  }

  /**
   * Lists spend permissions for a smart account.
   *
   * @param walletProvider - The server wallet provider to use for listing permissions.
   * @param args - The input arguments for listing spend permissions.
   * @returns A list of spend permissions available to the current wallet.
   */
  @CreateAction({
    name: "list_spend_permissions",
    description: `This tool lists spend permissions that have been granted to the current EVM wallet by a smart account.
It takes a smart account address and returns spend permissions where the current EVM wallet is the spender.
This is useful to see what spending allowances have been granted before using them.
This action is specifically designed for EVM wallets.`,
    schema: ListSpendPermissionsSchema,
  })
  async listSpendPermissions(
    walletProvider: WalletProvider,
    args: z.infer<typeof ListSpendPermissionsSchema>,
  ): Promise<string> {
    const network = walletProvider.getNetwork();

    if (isWalletProviderWithClient(walletProvider)) {
      if (network.protocolFamily === "evm") {
        return await listSpendPermissionsForSpender(
          walletProvider.getClient(),
          args.smartAccountAddress as Address,
          walletProvider.getAddress() as Address,
        );
      } else {
        return "Spend permissions are currently only supported on EVM networks.";
      }
    } else {
      return "Wallet provider is not a CDP Wallet Provider.";
    }
  }

  /**
   * Uses a spend permission to transfer tokens from a smart account to the current EVM wallet.
   *
   * @param walletProvider - The EVM wallet provider to use for the spend operation.
   * @param args - The input arguments for using the spend permission.
   * @returns A confirmation message with transaction details.
   */
  @CreateAction({
    name: "use_spend_permission",
    description: `This tool uses a spend permission to spend tokens on behalf of a smart account that the current EVM wallet has permission to spend.
It automatically finds the latest valid spend permission granted by the smart account to the current EVM wallet and uses it to spend the specified amount.
The smart account must have previously granted a spend permission to the current EVM wallet using createSpendPermission.
This action is specifically designed for EVM wallets and uses the EVM wallet for spend permission execution.`,
    schema: UseSpendPermissionSchema,
  })
  async useSpendPermission(
    walletProvider: WalletProvider,
    args: z.infer<typeof UseSpendPermissionSchema>,
  ): Promise<string> {
    const network = walletProvider.getNetwork();
    const cdpNetwork = this.#getCdpSdkNetwork(network.networkId!);

    if (isWalletProviderWithClient(walletProvider)) {
      if (network.protocolFamily === "evm") {
        try {
          const spenderAddress = walletProvider.getAddress();

          const permission = await findLatestSpendPermission(
            walletProvider.getClient(),
            args.smartAccountAddress as Address,
            spenderAddress as Address,
          );

          const account = await walletProvider.getClient().evm.getAccount({
            address: spenderAddress as Address,
          });

          const spendResult = await account.useSpendPermission({
            spendPermission: permission,
            value: BigInt(args.value),
            network: cdpNetwork as SpendPermissionNetwork,
          });

          return `Successfully spent ${args.value} tokens using spend permission. Transaction hash: ${spendResult.transactionHash}`;
        } catch (error) {
          return `Failed to use spend permission: ${error}`;
        }
      } else {
        return "Spend permissions are currently only supported on EVM networks.";
      }
    } else {
      return "Wallet provider is not a CDP Wallet Provider.";
    }
  }

  /**
   * Checks if the EVM wallet action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the EVM wallet action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) => {
    // EVM wallets support EVM networks in general
    return network.protocolFamily === "evm";
  };

  /**
   * Converts the internal network ID to the format expected by the CDP SDK.
   *
   * @param networkId - The network ID to convert
   * @returns The network ID in CDP SDK format
   * @throws Error if the network is not supported
   */
  #getCdpSdkNetwork(networkId: string): string {
    switch (networkId) {
      case "base-sepolia":
        return "base-sepolia";
      case "base-mainnet":
        return "base";
      case "ethereum-sepolia":
        return "ethereum-sepolia";
      case "ethereum-mainnet":
        return "ethereum";
      default:
        return networkId; // For other networks, use as-is
    }
  }
}

export const cdpEvmWalletActionProvider = () => new CdpEvmWalletActionProvider();
