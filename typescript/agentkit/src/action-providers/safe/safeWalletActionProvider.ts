import { z } from "zod";
import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { SafeWalletProvider } from "../../wallet-providers/safeWalletProvider";
import {
  AddSignerSchema,
  RemoveSignerSchema,
  ChangeThresholdSchema,
  ApprovePendingTransactionSchema,
  EnableAllowanceModuleSchema,
  SetAllowanceSchema,
} from "./schemas";
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
    description: `
Add a new signer to the Safe multi-sig wallet

Takes the following inputs:
- newSigner: Address of the new signer to add
- newThreshold: (Optional) New threshold after adding signer

Important notes:
- Must be called by an existing signer
- Requires confirmation from other signers if current threshold > 1
- New signer must not already be in the Safe
- New threshold cannot exceed number of signers
- If newThreshold not provided, keeps existing threshold if valid, otherwise reduces it

    `,
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
   * Approves and optionally executes a pending transaction for a Safe.
   *
   * @param walletProvider - The Safe wallet provider instance
   * @param args - Arguments containing safeAddress, safeTxHash, and optional executeImmediately flag
   * @returns A message containing the approval/execution details
   */
  @CreateAction({
    name: "approve_pending",
    description: `
Approves and optionally executes a pending transaction for connected Safe.
Takes the following inputs:
- safeTxHash: Transaction hash to approve/execute
- executeImmediately: (Optional) Whether to execute the transaction immediately if all signatures are collected (default: true)

Important notes:
- Must be called by an existing signer
- Will approve the transaction if not already approved
- Will execute the transaction if all required signatures are collected and executeImmediately is true
    `,
    schema: ApprovePendingTransactionSchema,
  })
  async approvePending(
    walletProvider: SafeWalletProvider,
    args: z.infer<typeof ApprovePendingTransactionSchema>,
  ): Promise<string> {
    return await walletProvider.approvePendingTransaction(args.safeTxHash, args.executeImmediately);
  }

  /**
   * Enables the allowance module for a Safe, allowing for token spending allowances.
   *
   * @param walletProvider - The wallet provider to connect to the Safe.
   * @returns A message containing the allowance module enabling details.
   */
  @CreateAction({
    name: "enable_allowance_module",
    description: `
Enables the allowance module for a Safe, allowing for token spending allowances.

Takes the following inputs:
- delegateAddress: Address that will receive the allowance
- tokenAddress:  Address of the ERC20 token
- amount: Amount of tokens to allow (e.g. '1.5' for 1.5 tokens)
- resetTimeInMinutes: Time in minutes after which the allowance resets, e.g 1440 for 24 hours (optional, defaults to 0 for one-time allowance)

Important notes:
- Must be called by an existing signer
- Requires confirmation from other signers if threshold > 1
- Module can only be enabled once
`,
    schema: EnableAllowanceModuleSchema,
  })
  async enableAllowanceModule(walletProvider: SafeWalletProvider): Promise<string> {
    return await walletProvider.enableAllowanceModule();
  }

  /**
   * Sets an allowance for a delegate to spend tokens from the Safe.
   *
   * @param walletProvider - The wallet provider to connect to the Safe.
   * @param args - The input arguments for setting the allowance.
   * @returns A message containing the allowance setting details.
   */
  @CreateAction({
    name: "set_allowance",
    description: `
Sets a token spending allowance for a delegate address.
Takes the following inputs:
- delegateAddress: Address that will receive the allowance
- tokenAddress:  Address of the ERC20 token
- amount: Amount of tokens to allow (e.g. '1.5' for 1.5 tokens)
- resetTimeInMinutes: Time in minutes after which the allowance resets, e.g 1440 for 24 hours (optional, defaults to 0 for one-time allowance)

Important notes:
- Must be called by an existing signer
- Allowance module must be enabled 
- Amount is in human-readable format (e.g. '1.5' for 1.5 tokens)
- Requires confirmation from other signers if threshold > 1
`,
    schema: SetAllowanceSchema,
  })
  async setAllowance(
    walletProvider: SafeWalletProvider,
    args: z.infer<typeof SetAllowanceSchema>,
  ): Promise<string> {
    return await walletProvider.setAllowance(
      args.delegateAddress,
      args.tokenAddress,
      args.amount,
      args.resetTimeInMinutes || 0,
    );
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
