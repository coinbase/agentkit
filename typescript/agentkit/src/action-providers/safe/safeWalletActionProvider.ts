import { z } from "zod";
import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { SafeWalletProvider } from "../../wallet-providers/safeWalletProvider";
import { AddSignerSchema, RemoveSignerSchema, ChangeThresholdSchema } from "./schemas";
import { Network } from "../../network";

/**
 * SafeWalletActionProvider provides actions for managing Safe multi-sig wallets.
 */
export class SafeWalletActionProvider extends ActionProvider<SafeWalletProvider> {
  /**
   * Constructor for the SafeWalletActionProvider class.
   *
   */
  constructor() {
    super("safe_wallet", []);
  }

  /**
   * Adds a new signer to the Safe wallet
   *
   * @param walletProvider - The Safe wallet provider instance
   * @param args - Arguments containing safeAddress and newSigner
   * @returns A promise that resolves to a success message
   */
  @CreateAction({
    name: "add_signer",
    description: "Add a new signer to the Safe multi-sig wallet",
    schema: AddSignerSchema,
  })
  async addSigner(
    walletProvider: SafeWalletProvider,
    args: z.infer<typeof AddSignerSchema>,
  ): Promise<string> {
    try {
      // Create and propose/execute the transaction
      const addOwnerTx = await walletProvider.addOwnerWithThreshold(
        args.newSigner,
        args.newThreshold,
      );

      return addOwnerTx;
    } catch (error) {
      throw new Error(
        `Failed to add signer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Removes a signer from the Safe wallet
   *
   * @param walletProvider - The Safe wallet provider instance
   * @param args - Arguments containing safeAddress, signerToRemove, and newThreshold
   * @returns A message containing the transaction details
   */
  @CreateAction({
    name: "remove_signer",
    description: `
Removes a signer from the Safe.
Takes the following inputs:
- signerToRemove: Address of the signer to remove
- newThreshold: (Optional) New threshold after removing signer

Important notes:
- Cannot remove the last signer
- If newThreshold not provided, keeps existing threshold if valid, otherwise reduces it
- Requires confirmation from other signers if current threshold > 1
    `,
    schema: RemoveSignerSchema,
  })
  async removeSigner(
    walletProvider: SafeWalletProvider,
    args: z.infer<typeof RemoveSignerSchema>,
  ): Promise<string> {
    return await walletProvider.removeOwnerWithThreshold(args.signerToRemove, args.newThreshold);
  }

  /**
   * Changes the threshold of the Safe.
   *
   * @param walletProvider - The Safe wallet provider instance
   * @param args - Arguments containing newThreshold
   * @returns A message containing the transaction details
   */
  @CreateAction({
    name: "change_threshold",
    description: `
Changes the confirmation threshold of the Safe.
Takes the following input:
- newThreshold: New threshold value (must be >= 1 and <= number of signers)

Important notes:
- Requires confirmation from other signers if current threshold > 1
- New threshold cannot exceed number of signers
    `,
    schema: ChangeThresholdSchema,
  })
  async changeThreshold(
    walletProvider: SafeWalletProvider,
    args: z.infer<typeof ChangeThresholdSchema>,
  ): Promise<string> {
    return await walletProvider.changeThreshold(args.newThreshold);
  }

  /**
   * Checks if the Safe action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Safe action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) => network.protocolFamily === "evm";
}

/**
 * Creates a new SafeWalletActionProvider instance.
 *
 * @returns A new SafeWalletActionProvider instance
 */
export const safeWalletActionProvider = () => new SafeWalletActionProvider();
