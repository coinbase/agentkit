import { SpendPermissionNetwork } from "@coinbase/cdp-sdk";
import { z } from "zod";
import { CdpSmartWalletProvider } from "../../wallet-providers/cdpSmartWalletProvider";
import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { UseSpendPermissionSchema, ListSpendPermissionsSchema } from "./schemas";
import { listSpendPermissionsForSpender, findLatestSpendPermission } from "./spendPermissionUtils";

import type { Network } from "../../network";
import type { Address } from "viem";

/**
 * CdpSmartWalletActionProvider is an action provider for CDP Smart Wallet specific actions.
 *
 * This provider is scoped specifically to CdpSmartWalletProvider and provides actions
 * that are optimized for smart wallet functionality.
 */
export class CdpSmartWalletActionProvider extends ActionProvider<CdpSmartWalletProvider> {
  /**
   * Constructor for the CdpSmartWalletActionProvider class.
   */
  constructor() {
    super("cdp_smart_wallet", []);
  }

  /**
   * Lists spend permissions for a smart account.
   *
   * @param walletProvider - The smart wallet provider to use for listing permissions.
   * @param args - The input arguments for listing spend permissions.
   * @returns A list of spend permissions available to the current wallet.
   */
  @CreateAction({
    name: "list_spend_permissions",
    description: `This tool lists spend permissions that have been granted to the current smart wallet by another smart account.
It takes a smart account address and returns spend permissions where the current smart wallet is the spender.
This is useful to see what spending allowances have been granted before using them.
This action is specifically designed for smart wallets.`,
    schema: ListSpendPermissionsSchema,
  })
  async listSpendPermissions(
    walletProvider: CdpSmartWalletProvider,
    args: z.infer<typeof ListSpendPermissionsSchema>,
  ): Promise<string> {
    const network = walletProvider.getNetwork();

    if (network.protocolFamily === "evm") {
      const spenderAddress = walletProvider.getAddress();
      return await listSpendPermissionsForSpender(
        walletProvider.getClient(),
        args.smartAccountAddress as Address,
        spenderAddress as Address,
      );
    } else {
      return "Spend permissions are currently only supported on EVM networks.";
    }
  }

  /**
   * Uses a spend permission to transfer tokens from a smart account to the current smart wallet.
   *
   * @param walletProvider - The smart wallet provider to use for the spend operation.
   * @param args - The input arguments for using the spend permission.
   * @returns A confirmation message with transaction details.
   */
  @CreateAction({
    name: "use_spend_permission",
    description: `This tool uses a spend permission to spend tokens on behalf of a smart account that the current smart wallet has permission to spend.
It automatically finds the latest valid spend permission granted by the smart account to the current smart wallet and uses it to spend the specified amount.
The smart account must have previously granted a spend permission to the current smart wallet using createSpendPermission.
This action is specifically designed for smart wallets and uses the smart account directly for optimal performance.`,
    schema: UseSpendPermissionSchema,
  })
  async useSpendPermission(
    walletProvider: CdpSmartWalletProvider,
    args: z.infer<typeof UseSpendPermissionSchema>,
  ): Promise<string> {
    const network = walletProvider.getNetwork();
    const cdpNetwork = this.#getCdpSdkNetwork(network.networkId!);

    if (network.protocolFamily === "evm") {
      try {
        const permission = await findLatestSpendPermission(
          walletProvider.getClient(),
          args.smartAccountAddress as Address,
          walletProvider.getAddress() as Address,
        );

        const spendResult = await walletProvider.smartAccount.useSpendPermission({
          spendPermission: permission,
          value: BigInt(args.value),
          network: cdpNetwork as SpendPermissionNetwork,
        });

        return `Successfully spent ${args.value} tokens using spend permission. Status: ${spendResult.status}`;
      } catch (error) {
        throw new Error(`Failed to use spend permission: ${error}`);
      }
    } else {
      throw new Error("Spend permissions are currently only supported on EVM networks.");
    }
  }

  /**
   * Checks if the smart wallet action provider supports the given network.
   *
   * @param _  - The network to check.
   * @returns True if the smart wallet action provider supports the network, false otherwise.
   */
  supportsNetwork = (_: Network): boolean => {
    return true;
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
      default:
        throw new Error(`Unsupported network for smart wallets: ${networkId}`);
    }
  }
}

export const cdpSmartWalletActionProvider = () => new CdpSmartWalletActionProvider();
