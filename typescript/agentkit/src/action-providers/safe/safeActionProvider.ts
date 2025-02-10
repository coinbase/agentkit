import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import {
  InitializeSafeSchema,
  SafeInfoSchema,
  AddSignerSchema,
  RemoveSignerSchema,
  ChangeThresholdSchema,
  ExecutePendingSchema,
  WithdrawFromSafeSchema,
  EnableAllowanceModuleSchema,
} from "./schemas";
import { Network } from "../../network";
import { NETWORK_ID_TO_VIEM_CHAIN } from "../../network/network";
import { EvmWalletProvider } from "../../wallet-providers/evmWalletProvider";

import { Chain } from "viem/chains";
import { waitForTransactionReceipt } from "viem/actions";

import Safe, { PredictedSafeProps } from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";
import { getAllowanceModuleDeployment } from "@safe-global/safe-modules-deployments";
import { initializeClientIfNeeded } from "./utils";

/**
 * Configuration options for the SafeActionProvider.
 */
export interface SafeActionProviderConfig {
  /**
   * The private key to use for the SafeActionProvider.
   */
  privateKey?: string;

  /**
   * The network ID to use for the SafeActionProvider.
   */
  networkId?: string;
}

/**
 * SafeActionProvider is an action provider for Safe smart account interactions.
 */
export class SafeActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly privateKey: string;
  private readonly chain: Chain;
  private apiKit: SafeApiKit;
  private safeClient: Safe | null = null;
  private safeBaseUrl: string;

  /**
   * Constructor for the SafeActionProvider class.
   *
   * @param config - The configuration options for the SafeActionProvider.
   */
  constructor(config: SafeActionProviderConfig = {}) {
    super("safe", []);

    // Initialize chain
    this.chain = NETWORK_ID_TO_VIEM_CHAIN[config.networkId || "base-sepolia"];
    if (!this.chain) throw new Error(`Unsupported network: ${config.networkId}`);

    // Initialize private key
    const privateKey = config.privateKey;
    if (!privateKey) throw new Error("Private key is not configured");
    this.privateKey = privateKey;

    // Initialize apiKit with chain ID from Viem chain
    this.apiKit = new SafeApiKit({
      chainId: BigInt(this.chain.id),
    });
    this.safeBaseUrl = "https://app.safe.global/";
  }

  /**
   * Initializes a new Safe smart account.
   *
   * @param walletProvider - The wallet provider to create the Safe.
   * @param args - The input arguments for creating a Safe.
   * @returns A message containing the Safe creation details.
   */
  @CreateAction({
    name: "create_safe",
    description: `
Creates a new Safe smart account.
Takes the following inputs:
- signers: Array of additional signer addresses (optional, default: [])
- threshold: Number of required confirmations (optional, default: 1)

Important notes:
- Requires gas to deploy the Safe contract
- The deployer (private key owner) will be automatically added as a signer
- Threshold must be <= number of signers
    `,
    schema: InitializeSafeSchema,
  })
  async initializeSafe(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof InitializeSafeSchema>,
  ): Promise<string> {
    try {
      const predictedSafe: PredictedSafeProps = {
        safeAccountConfig: {
          owners: [walletProvider.getAddress(), ...args.signers],
          threshold: args.threshold,
        },
        safeDeploymentConfig: {
          saltNonce: BigInt(Date.now()).toString(),
        },
      };

      let safeClient = await Safe.init({
        provider: walletProvider.getPublicClient().transport,
        signer: this.privateKey,
        predictedSafe,
      });

      const safeAddress = await safeClient.getAddress();
      const deploymentTransaction = await safeClient.createSafeDeploymentTransaction();

      // Execute transaction
      const client = await safeClient.getSafeProvider().getExternalSigner();
      const txHash = await client?.sendTransaction({
        to: deploymentTransaction.to,
        value: BigInt(deploymentTransaction.value),
        data: deploymentTransaction.data as `0x${string}`,
        chain: this.chain,
      });
      const txReceipt = await waitForTransactionReceipt(client!, { hash: txHash! });
      const txLink = `${walletProvider.getPublicClient().chain?.blockExplorers?.default.url}/tx/${txReceipt.transactionHash}`;

      // Reconnect to newly deployed Safe
      safeClient = await safeClient.connect({ safeAddress });

      if (await safeClient.isSafeDeployed()) {
        this.safeClient = safeClient;

        const safeAddress = await safeClient.getAddress();
        const safeOwners = await safeClient.getOwners();
        const safeThreshold = await safeClient.getThreshold();

        return `Successfully created Safe at address ${safeAddress} with signers ${safeOwners} and threshold of ${safeThreshold}. Transaction link: ${txLink}. Safe dashboard link: ${this.safeBaseUrl}/home?safe=${safeAddress}`;
      } else {
        return `Error creating Safe`;
      }
    } catch (error) {
      return `Error creating Safe: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Connects to an existing Safe smart account.
   *
   * @param walletProvider - The wallet provider to connect to the Safe.
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
      // Connect to Safe client
      this.safeClient = await initializeClientIfNeeded(
        this.safeClient,
        args.safeAddress,
        walletProvider.getPublicClient().transport,
        this.privateKey,
      );

      // Get Safe info
      const owners = await this.safeClient.getOwners();
      const threshold = await this.safeClient.getThreshold();
      const pendingTransactions = await this.apiKit.getPendingTransactions(args.safeAddress);
      const balance = await walletProvider
        .getPublicClient()
        .getBalance({ address: args.safeAddress });
      const ethBalance = balance ? parseFloat(balance.toString()) / 1e18 : 0;

      // Get pending transactions
      const pendingTxDetails = pendingTransactions.results
        .filter(tx => !tx.isExecuted)
        .map(tx => {
          const confirmations = tx.confirmations?.length || 0;
          const needed = tx.confirmationsRequired;
          const confirmedBy = tx.confirmations?.map(c => c.owner).join(", ") || "none";
          return `\n- Transaction ${tx.safeTxHash} (${confirmations}/${needed} confirmations, confirmed by: ${confirmedBy})`;
        })
        .join("");

      return `Safe at address ${args.safeAddress}:
- Balance: ${ethBalance.toFixed(5)} ETH
- ${owners.length} owners: ${owners.join(", ")}
- Threshold: ${threshold}
- Pending transactions: ${pendingTransactions.count}${pendingTxDetails}`;
    } catch (error) {
      return `Error connecting to Safe: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Adds a new signer to an existing Safe.
   *
   * @param walletProvider - The wallet provider to connect to the Safe.
   * @param args - The input arguments for adding a signer.
   * @returns A message containing the signer addition details.
   */
  @CreateAction({
    name: "add_signer",
    description: `
Adds a new signer to an existing Safe.
Takes the following inputs:
- safeAddress: Address of the Safe to modify
- newSigner: Address of the new signer to add
- newThreshold: (Optional) New threshold after adding signer

Important notes:
- Requires an existing Safe
- Must be called by an existing signer
- Requires confirmation from other signers if threshold > 1
- If newThreshold not provided, keeps existing threshold
`,
    schema: AddSignerSchema,
  })
  async addSigner(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof AddSignerSchema>,
  ): Promise<string> {
    try {
      // Connect to Safe client
      this.safeClient = await initializeClientIfNeeded(
        this.safeClient,
        args.safeAddress,
        walletProvider.getPublicClient().transport,
        this.privateKey,
      );

      // Get current threshold
      const currentThreshold = await this.safeClient.getThreshold();

      // Add new signer
      const safeTransaction = await this.safeClient.createAddOwnerTx({
        ownerAddress: args.newSigner,
        threshold: args.newThreshold || currentThreshold,
      });

      if (currentThreshold > 1) {
        // Multi-sig flow: propose transaction
        const safeTxHash = await this.safeClient.getTransactionHash(safeTransaction);
        const signature = await this.safeClient.signHash(safeTxHash);

        await this.apiKit.proposeTransaction({
          safeAddress: args.safeAddress,
          safeTransactionData: safeTransaction.data,
          safeTxHash,
          senderSignature: signature.data,
          senderAddress: walletProvider.getAddress(),
        });

        return `Successfully proposed adding signer ${args.newSigner} to Safe ${args.safeAddress}. Safe transaction hash: ${safeTxHash}. The other signers will need to confirm the transaction before it can be executed.`;
      } else {
        // Single-sig flow: execute immediately
        await this.safeClient.executeTransaction(safeTransaction);
        return `Successfully added signer ${args.newSigner} to Safe ${args.safeAddress}.`;
      }
    } catch (error) {
      return `Error adding signer: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Removes a signer from an existing Safe.
   *
   * @param walletProvider - The wallet provider to connect to the Safe.
   * @param args - The input arguments for removing a signer.
   * @returns A message containing the signer removal details.
   */
  @CreateAction({
    name: "remove_signer",
    description: `
Removes a signer from an existing Safe.
Takes the following inputs:
- safeAddress: Address of the Safe to modify
- signerToRemove: Address of the signer to remove
- newThreshold: (Optional) New threshold after removing signer

Important notes:
- Requires an existing Safe
- Must be called by an existing signer
- Cannot remove the last signer
- If newThreshold not provided, keeps existing threshold if valid
`,
    schema: RemoveSignerSchema,
  })
  async removeSigner(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RemoveSignerSchema>,
  ): Promise<string> {
    try {
      // Connect to Safe client
      this.safeClient = await initializeClientIfNeeded(
        this.safeClient,
        args.safeAddress,
        walletProvider.getPublicClient().transport,
        this.privateKey,
      );

      const currentSigners = await this.safeClient.getOwners();
      const currentThreshold = await this.safeClient.getThreshold();

      if (currentSigners.length <= 1) {
        throw new Error("Cannot remove the last signer");
      }

      const safeTransaction = await this.safeClient.createRemoveOwnerTx({
        ownerAddress: args.signerToRemove,
        threshold:
          args.newThreshold ||
          (currentThreshold > currentSigners.length - 1
            ? currentSigners.length - 1
            : currentThreshold),
      });

      if (currentThreshold > 1) {
        // Multi-sig flow: propose transaction
        const safeTxHash = await this.safeClient.getTransactionHash(safeTransaction);
        const signature = await this.safeClient.signHash(safeTxHash);

        await this.apiKit.proposeTransaction({
          safeAddress: args.safeAddress,
          safeTransactionData: safeTransaction.data,
          safeTxHash,
          senderSignature: signature.data,
          senderAddress: walletProvider.getAddress(),
        });

        return `Successfully proposed removing signer ${args.signerToRemove} from Safe ${args.safeAddress}. Safe transaction hash: ${safeTxHash}. The other signers will need to confirm the transaction before it can be executed.`;
      } else {
        // Single-sig flow: execute immediately
        await this.safeClient.executeTransaction(safeTransaction);
        return `Successfully removed signer ${args.signerToRemove} from Safe ${args.safeAddress}`;
      }
    } catch (error) {
      return `Error removing signer: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Changes the confirmation threshold of an existing Safe.
   *
   * @param walletProvider - The wallet provider to connect to the Safe.
   * @param args - The input arguments for changing the threshold.
   * @returns A message containing the threshold change details.
   */
  @CreateAction({
    name: "change_threshold",
    description: `
Changes the confirmation threshold of an existing Safe.
Takes the following inputs:
- safeAddress: Address of the Safe to modify
- newThreshold: New threshold value (must be >= 1 and <= number of signers)

Important notes:
- Requires an existing Safe
- Must be called by an existing signer
- New threshold must not exceed number of signers
`,
    schema: ChangeThresholdSchema,
  })
  async changeThreshold(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ChangeThresholdSchema>,
  ): Promise<string> {
    try {
      // Connect to Safe client
      this.safeClient = await initializeClientIfNeeded(
        this.safeClient,
        args.safeAddress,
        walletProvider.getPublicClient().transport,
        this.privateKey,
      );

      const currentSigners = await this.safeClient.getOwners();
      const currentThreshold = await this.safeClient.getThreshold();

      if (args.newThreshold > currentSigners.length) {
        throw new Error("New threshold cannot exceed number of signers");
      }

      const safeTransaction = await this.safeClient.createChangeThresholdTx(args.newThreshold);

      if (currentThreshold > 1) {
        // Multi-sig flow: propose transaction
        const safeTxHash = await this.safeClient.getTransactionHash(safeTransaction);
        const signature = await this.safeClient.signHash(safeTxHash);

        await this.apiKit.proposeTransaction({
          safeAddress: args.safeAddress,
          safeTransactionData: safeTransaction.data,
          safeTxHash,
          senderSignature: signature.data,
          senderAddress: walletProvider.getAddress(),
        });

        return `Successfully proposed changing threshold to ${args.newThreshold} for Safe ${args.safeAddress}. Safe transaction hash: ${safeTxHash}. The other signers will need to confirm the transaction before it can be executed.`;
      } else {
        // Single-sig flow: execute immediately
        await this.safeClient.executeTransaction(safeTransaction);
        return `Successfully changed threshold to ${args.newThreshold} for Safe ${args.safeAddress}`;
      }
    } catch (error) {
      return `Error changing threshold: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Executes pending transactions for a Safe if enough signatures are collected.
   *
   * @param walletProvider - The wallet provider to connect to the Safe.
   * @param args - The input arguments for executing pending transactions.
   * @returns A message containing the execution details.
   */
  @CreateAction({
    name: "execute_pending",
    description: `
Executes pending transactions for a Safe if enough signatures are collected.
Takes the following inputs:
- safeAddress: Address of the Safe
- safeTxHash: (Optional) Specific transaction hash to execute. If not provided, will try to execute all pending transactions

Important notes:
- Requires an existing Safe
- Must be called by an existing signer
- Transaction must have enough signatures to meet threshold
- Will fail if threshold is not met
`,
    schema: ExecutePendingSchema,
  })
  async executePending(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ExecutePendingSchema>,
  ): Promise<string> {
    try {
      // Connect to Safe client
      this.safeClient = await initializeClientIfNeeded(
        this.safeClient,
        args.safeAddress,
        walletProvider.getPublicClient().transport,
        this.privateKey,
      );

      const pendingTxs = await this.apiKit.getPendingTransactions(args.safeAddress);

      if (pendingTxs.results.length === 0) {
        return "No pending transactions found.";
      }

      let executedTxs = 0;
      let skippedTxs = 0;
      const txsToProcess = args.safeTxHash
        ? pendingTxs.results.filter(
            tx => tx.safeTxHash === args.safeTxHash && tx.isExecuted === false,
          )
        : pendingTxs.results.filter(tx => tx.isExecuted === false);

      for (const tx of txsToProcess) {
        // Skip if not enough confirmations
        if (tx.confirmations && tx.confirmations.length < tx.confirmationsRequired) {
          skippedTxs++;
          continue;
        }
        await this.safeClient.executeTransaction(tx);
        executedTxs++;
      }

      if (executedTxs === 0 && skippedTxs > 0) {
        return `No transactions executed. ${skippedTxs} transaction(s) have insufficient confirmations.`;
      }

      return `Execution complete. Successfully executed ${executedTxs} transaction(s)${skippedTxs > 0 ? `, ${skippedTxs} still pending and need more confirmations` : ""}.${
        args.safeTxHash ? ` Safe transaction hash: ${args.safeTxHash}` : ""
      }`;
    } catch (error) {
      return `Error executing transactions: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Withdraws ETH from the Safe.
   *
   * @param walletProvider - The wallet provider to connect to the Safe.
   * @param args - The input arguments for withdrawing ETH.
   * @returns A message containing the withdrawal details.
   */
  @CreateAction({
    name: "withdraw_eth",
    description: `
Withdraws ETH from the Safe.
Takes the following inputs:
- safeAddress: Address of the Safe
- recipientAddress: Address to receive the ETH
- amount: (Optional) Amount of ETH to withdraw. If not provided, withdraws entire balance

Important notes:
- Requires an existing Safe
- Must be called by an existing signer
- Requires confirmation from other signers if threshold > 1
`,
    schema: WithdrawFromSafeSchema,
  })
  async withdrawEth(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof WithdrawFromSafeSchema>,
  ): Promise<string> {
    try {
      // Connect to Safe client
      this.safeClient = await initializeClientIfNeeded(
        this.safeClient,
        args.safeAddress,
        walletProvider.getPublicClient().transport,
        this.privateKey,
      );

      const currentThreshold = await this.safeClient.getThreshold();
      const balance = await walletProvider
        .getPublicClient()
        .getBalance({ address: args.safeAddress });

      // Calculate amount to withdraw
      let withdrawAmount: bigint;
      if (args.amount) {
        withdrawAmount = BigInt(Math.floor(parseFloat(args.amount) * 1e18));
        if (withdrawAmount > balance) {
          throw new Error(
            `Insufficient balance. Safe has ${parseFloat(balance.toString()) / 1e18} ETH`,
          );
        }
      } else {
        withdrawAmount = balance;
      }

      const safeTransaction = await this.safeClient.createTransaction({
        transactions: [
          {
            to: args.recipientAddress,
            data: "0x",
            value: withdrawAmount.toString(),
          },
        ],
      });

      if (currentThreshold > 1) {
        // Multi-sig flow: propose transaction
        const safeTxHash = await this.safeClient.getTransactionHash(safeTransaction);
        const signature = await this.safeClient.signHash(safeTxHash);

        await this.apiKit.proposeTransaction({
          safeAddress: args.safeAddress,
          safeTransactionData: safeTransaction.data,
          safeTxHash,
          senderSignature: signature.data,
          senderAddress: walletProvider.getAddress(),
        });

        return `Successfully proposed withdrawing ${parseFloat(withdrawAmount.toString()) / 1e18} ETH to ${args.recipientAddress}. Safe transaction hash: ${safeTxHash}. The other signers will need to confirm the transaction before it can be executed.`;
      } else {
        // Single-sig flow: execute immediately
        await this.safeClient.executeTransaction(safeTransaction);
        return `Successfully withdrew ${parseFloat(withdrawAmount.toString()) / 1e18} ETH to ${args.recipientAddress}`;
      }
    } catch (error) {
      return `Error withdrawing ETH: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Enables the allowance module for a Safe, allowing for token spending allowances.
   *
   * @param walletProvider - The wallet provider to connect to the Safe.
   * @param args - The input arguments for enabling the allowance module.
   * @returns A message containing the allowance module enabling details.
   */
  @CreateAction({
    name: "enable_allowance_module",
    description: `
Enables the allowance module for a Safe, allowing for token spending allowances.
Takes the following input:
- safeAddress: Address of the Safe

Important notes:
- Requires an existing Safe
- Must be called by an existing signer
- Requires confirmation from other signers if threshold > 1
- Module can only be enabled once
`,
    schema: EnableAllowanceModuleSchema,
  })
  async enableAllowanceModule(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof EnableAllowanceModuleSchema>,
  ): Promise<string> {
    try {
      // Connect to Safe client
      this.safeClient = await initializeClientIfNeeded(
        this.safeClient,
        args.safeAddress,
        walletProvider.getPublicClient().transport,
        this.privateKey,
      );

      const isSafeDeployed = await this.safeClient.isSafeDeployed();
      if (!isSafeDeployed) {
        throw new Error("Safe not deployed");
      }

      // Get allowance module address for current chain
      const chainId = this.chain.id.toString();
      const allowanceModule = getAllowanceModuleDeployment({ network: chainId });
      if (!allowanceModule) {
        throw new Error(`Allowance module not found for chainId [${chainId}]`);
      }

      // Check if module is already enabled
      const moduleAddress = allowanceModule.networkAddresses[chainId];
      const isAlreadyEnabled = await this.safeClient.isModuleEnabled(moduleAddress);
      if (isAlreadyEnabled) {
        return "Allowance module is already enabled for this Safe";
      }

      // Create and execute/propose transaction
      const safeTransaction = await this.safeClient.createEnableModuleTx(moduleAddress);
      const currentThreshold = await this.safeClient.getThreshold();

      if (currentThreshold > 1) {
        // Multi-sig flow: propose transaction
        const safeTxHash = await this.safeClient.getTransactionHash(safeTransaction);
        const signature = await this.safeClient.signHash(safeTxHash);

        await this.apiKit.proposeTransaction({
          safeAddress: args.safeAddress,
          safeTransactionData: safeTransaction.data,
          safeTxHash,
          senderSignature: signature.data,
          senderAddress: walletProvider.getAddress(),
        });

        return `Successfully proposed enabling allowance module for Safe ${args.safeAddress}. Safe transaction hash: ${safeTxHash}. The other signers will need to confirm the transaction before it can be executed.`;
      } else {
        // Single-sig flow: execute immediately
        await this.safeClient.executeTransaction(safeTransaction);
        return `Successfully enabled allowance module for Safe ${args.safeAddress}`;
      }
    } catch (error) {
      return `Error enabling allowance module: ${error instanceof Error ? error.message : String(error)}`;
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

export const safeActionProvider = (config?: SafeActionProviderConfig) =>
  new SafeActionProvider(config);
