import { EvmWalletProvider } from "./evmWalletProvider";
import { Network } from "../network";
import {
  Account,
  Chain,
  createPublicClient,
  http,
  parseEther,
  parseUnits,
  ReadContractParameters,
  ReadContractReturnType,
  encodeFunctionData,
  Hex,
  TransactionRequest,
  SignableMessage,
  ContractFunctionArgs,
  ContractFunctionName,
  Abi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN_ID_TO_NETWORK_ID, NETWORK_ID_TO_VIEM_CHAIN } from "../network/network";
import { PublicClient } from "viem";

import { abi as ERC20_ABI } from "../action-providers/erc20/constants";

// Safe SDK imports
import Safe from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";
import { getAllowanceModuleDeployment } from "@safe-global/safe-modules-deployments";
/**
 * Configuration options for the SafeWalletProvider.
 */
export interface SafeWalletProviderConfig {
  /**
   * Private key of the signer that (co-)owns the Safe.
   */
  privateKey: string;

  /**
   * Network ID, for example "base-sepolia" or "ethereum-mainnet".
   */
  networkId: string;

  /**
   * Optional existing Safe address. If provided, will connect to that Safe;
   * otherwise, this provider will deploy a new Safe with the private key as one the only owner.
   */
  safeAddress?: string;
}

/**
 * SafeWalletProvider is a wallet provider implementation that uses Safe multi-signature accounts.
 * When instantiated, this provider can either connect to an existing Safe or deploy a new one.
 */
export class SafeWalletProvider extends EvmWalletProvider {
  #privateKey: string;
  #account: Account;
  #chain: Chain;
  #safeAddress: string | null = null;
  #isInitialized: boolean = false;
  #publicClient: PublicClient;
  #safeClient: Safe | null = null;
  #apiKit: SafeApiKit;
  #initializationPromise: Promise<void>;

  /**
   * Creates a new SafeWalletProvider instance.
   *
   * @param config - The configuration options for the SafeWalletProvider.
   */
  constructor(config: SafeWalletProviderConfig) {
    super();

    // Get chain ID from network ID
    this.#chain = NETWORK_ID_TO_VIEM_CHAIN[config.networkId || "base-sepolia"];
    if (!this.#chain) throw new Error(`Unsupported network: ${config.networkId}`);

    // Create default public viem client
    this.#publicClient = createPublicClient({
      chain: this.#chain,
      transport: http(),
    });

    // Initialize apiKit with chain ID from Viem chain
    this.#apiKit = new SafeApiKit({
      chainId: BigInt(this.#chain.id),
    });

    // Connect to an existing Safe or deploy a new one with account of private key as single owner
    this.#privateKey = config.privateKey;
    this.#account = privateKeyToAccount(this.#privateKey as Hex);

    this.#initializationPromise = this.initializeSafe(config.safeAddress).then(
      address => {
        this.#safeAddress = address;
        this.#isInitialized = true;
        this.trackInitialization();
      },
      error => {
        throw new Error("Error initializing Safe wallet: " + error);
      },
    );
  }

  /**
   * Returns a promise that resolves when the wallet is initialized
   *
   * @returns Promise that resolves when initialization is complete
   */
  async waitForInitialization(): Promise<void> {
    return this.#initializationPromise;
  }

  /**
   * Returns the Safe address once it is initialized.
   * If the Safe isn't yet deployed or connected, throws an error.
   *
   * @returns The Safe's address.
   * @throws Error if Safe is not initialized.
   */
  getAddress(): string {
    if (!this.#safeAddress) {
      throw new Error("Safe not yet initialized.");
    }
    return this.#safeAddress;
  }

  /**
   * Returns the Network object for this Safe.
   *
   * @returns Network configuration for this Safe.
   */
  getNetwork(): Network {
    return {
      protocolFamily: "evm",
      networkId: CHAIN_ID_TO_NETWORK_ID[this.#chain.id],
      chainId: this.#chain.id.toString(),
    };
  }

  /**
   * Returns the name of this wallet provider.
   *
   * @returns The string "safe_wallet_provider".
   */
  getName(): string {
    return "safe_wallet_provider";
  }

  /**
   * Queries the current Safe balance.
   *
   * @returns The balance in wei.
   * @throws Error if Safe address is not set.
   */
  async getBalance(): Promise<bigint> {
    if (!this.#safeAddress) throw new Error("Safe address is not set.");
    const balance = await this.#publicClient.getBalance({
      address: this.#safeAddress as Hex,
    });
    return balance;
  }

  /**
   * Transfers native tokens from the Safe to the specified address.
   * If single-owner, executes immediately.
   * If multi-sig, proposes the transaction.
   *
   * @param to - The destination address
   * @param value - The amount in decimal form (e.g. "0.5" for 0.5 ETH)
   * @returns Transaction hash if executed or Safe transaction hash if proposed
   */
  async nativeTransfer(to: string, value: string): Promise<string> {
    if (!this.#safeClient) throw new Error("Safe client is not set.");

    try {
      // Convert decimal ETH to wei
      const ethAmountInWei = parseEther(value);

      // Create the transaction
      const safeTx = await this.#safeClient.createTransaction({
        transactions: [
          {
            to: to as Hex,
            data: "0x",
            value: ethAmountInWei.toString(),
          },
        ],
      });

      // Get current threshold
      const threshold = await this.#safeClient.getThreshold();

      if (threshold > 1) {
        // Multi-sig flow: propose transaction
        const safeTxHash = await this.#safeClient.getTransactionHash(safeTx);
        const signature = await this.#safeClient.signHash(safeTxHash);

        // Propose the transaction
        await this.#apiKit.proposeTransaction({
          safeAddress: this.getAddress(),
          safeTransactionData: safeTx.data,
          safeTxHash,
          senderSignature: signature.data,
          senderAddress: this.#account.address,
        });

        return `Proposed transaction with Safe transaction hash: ${safeTxHash}. Other owners will need to confirm the transaction before it can be executed.`;
      } else {
        // Single-sig flow: execute immediately
        const response = await this.#safeClient.executeTransaction(safeTx);
        const receipt = await this.waitForTransactionReceipt(response.hash as Hex);
        return `Successfully transferred ${value} ETH to ${to}. Transaction hash: ${receipt.transactionHash}`;
      }
    } catch (error) {
      throw new Error(
        `Failed to transfer: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Signs a hash using the private key of the account that is co-owner of the Safe.
   * Note: This signs with the owner's key, not through the Safe itself.
   *
   * @param hash - The hash to sign.
   * @returns The signature as a hex string.
   */
  async signHash(hash: Hex): Promise<Hex> {
    if (!this.#account) {
      throw new Error("Account not initialized");
    }

    return this.#account.sign!({ hash });
  }

  /**
   * Signs a message using the private key of the account that is co-owner of the Safe.
   * Note: This signs with the owner's key, not through the Safe itself.
   *
   * @param message - The message to sign.
   * @returns The signature as a hex string.
   */
  async signMessage(message: string | Uint8Array): Promise<Hex> {
    if (!this.#account) {
      throw new Error("Account not initialized");
    }

    return this.#account.signMessage!({ message: message as SignableMessage });
  }

  /**
   * Signs typed data using the private key of the account that is co-owner of the Safe.
   * Note: This signs with the owner's key, not through the Safe itself.
   *
   * @param typedData - The typed data to sign.
   * @returns The signature as a hex string.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async signTypedData(typedData: any): Promise<Hex> {
    if (!this.#account) {
      throw new Error("Account not initialized");
    }

    return this.#account.signTypedData!({
      domain: typedData.domain,
      types: typedData.types,
      primaryType: typedData.primaryType,
      message: typedData.message,
    });
  }

  /**
   * Signs a transaction using the Safe protocol.
   * This creates a Safe transaction and returns the signature, but doesn't execute it.
   *
   * @param transaction - The transaction to sign.
   * @returns The signature as a hex string.
   */
  async signTransaction(transaction: TransactionRequest): Promise<Hex> {
    if (!this.#safeClient) {
      throw new Error("Safe client is not set");
    }

    try {
      // Create a Safe transaction object
      const safeTx = await this.#safeClient.createTransaction({
        transactions: [
          {
            to: transaction.to as Hex,
            data: (transaction.data as Hex) || "0x",
            value: transaction.value?.toString() || "0",
          },
        ],
      });

      // Sign the transaction hash
      const signature = await this.#safeClient.signTransaction(safeTx);

      // Return the signature
      return signature as unknown as Hex;
    } catch (error) {
      throw new Error(
        `Failed to sign transaction: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Sends a transaction through the Safe.
   * For single-owner Safes, executes immediately.
   * For multi-owner Safes, proposes the transaction for other owners to confirm.
   *
   * @param transaction - The transaction to send
   * @returns The transaction hash if executed immediately, or the Safe transaction hash if proposed
   */
  async sendTransaction(transaction: TransactionRequest): Promise<Hex> {
    if (!this.#safeClient) throw new Error("Safe client is not set.");

    try {
      // Create the Safe transaction
      const safeTx = await this.#safeClient.createTransaction({
        transactions: [
          {
            to: transaction.to as Hex,
            data: (transaction.data as Hex) || "0x",
            value: transaction.value?.toString() || "0",
          },
        ],
      });

      // Get current threshold
      const threshold = await this.#safeClient.getThreshold();

      if (threshold > 1) {
        // Multi-sig flow: propose transaction
        const safeTxHash = await this.#safeClient.getTransactionHash(safeTx);
        const signature = await this.#safeClient.signHash(safeTxHash);

        // Propose the transaction
        await this.#apiKit.proposeTransaction({
          safeAddress: this.getAddress(),
          safeTransactionData: safeTx.data,
          safeTxHash,
          senderSignature: signature.data,
          senderAddress: this.#account.address,
        });

        return safeTxHash as Hex;
      } else {
        // Single-sig flow: execute immediately
        const response = await this.#safeClient.executeTransaction(safeTx);

        await this.waitForTransactionReceipt(response.hash as Hex);
        return response.hash as Hex;
      }
    } catch (error) {
      throw new Error(
        `Failed to send transaction: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Waits for a transaction receipt.
   *
   * @param txHash - The hash of the transaction to wait for.
   * @returns The transaction receipt from the network.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async waitForTransactionReceipt(txHash: Hex): Promise<any> {
    return await this.#publicClient.waitForTransactionReceipt({ hash: txHash });
  }

  /**
   * Reads a contract.
   *
   * @param params - The parameters to read the contract.
   * @returns The response from the contract.
   */
  async readContract<
    const abi extends Abi | readonly unknown[],
    functionName extends ContractFunctionName<abi, "pure" | "view">,
    const args extends ContractFunctionArgs<abi, "pure" | "view", functionName>,
  >(
    params: ReadContractParameters<abi, functionName, args>,
  ): Promise<ReadContractReturnType<abi, functionName, args>> {
    return this.#publicClient.readContract<abi, functionName, args>(params);
  }

  /**
   * Gets the public client instance.
   *
   * @returns The Viem PublicClient instance.
   */
  getPublicClient(): PublicClient {
    return this.#publicClient;
  }

  /**
   * Gets the current owners of the Safe.
   *
   * @returns Array of owner addresses.
   * @throws Error if Safe client is not set.
   */
  async getOwners(): Promise<string[]> {
    if (!this.#safeClient) throw new Error("Safe client is not set.");
    return await this.#safeClient.getOwners();
  }

  /**
   * Gets the current threshold of the Safe.
   *
   * @returns Current threshold number.
   * @throws Error if Safe client is not set.
   */
  async getThreshold(): Promise<number> {
    if (!this.#safeClient) throw new Error("Safe client is not set.");
    return await this.#safeClient.getThreshold();
  }

  /**
   * Adds a new owner to the Safe.
   *
   * @param newSigner - The address of the new owner.
   * @param newThreshold - The threshold for the new owner.
   * @returns Transaction hash
   */
  async addOwnerWithThreshold(
    newSigner: string,
    newThreshold: number | undefined,
  ): Promise<string> {
    if (!this.#safeClient) throw new Error("Safe client is not set.");

    // Get current Safe settings
    const currentOwners = await this.getOwners();
    const currentThreshold = await this.getThreshold();

    // Validate new signer isn't already an owner
    if (currentOwners.includes(newSigner.toLowerCase()))
      throw new Error("Address is already an owner of this Safe");

    // Determine new threshold (keep current if not specified)
    newThreshold = newThreshold || currentThreshold;

    // Validate threshold
    const newOwnerCount = currentOwners.length + 1;
    if (newThreshold > newOwnerCount)
      throw new Error(
        `Invalid threshold: ${newThreshold} cannot be greater than number of owners (${newOwnerCount})`,
      );
    if (newThreshold < 1) throw new Error("Threshold must be at least 1");

    // Add new signer
    const safeTransaction = await this.#safeClient.createAddOwnerTx({
      ownerAddress: newSigner,
      threshold: newThreshold,
    });

    if (currentThreshold > 1) {
      // Multi-sig flow: propose transaction
      const safeTxHash = await this.#safeClient.getTransactionHash(safeTransaction);
      const signature = await this.#safeClient.signHash(safeTxHash);

      await this.#apiKit.proposeTransaction({
        safeAddress: this.getAddress(),
        safeTransactionData: safeTransaction.data,
        safeTxHash,
        senderSignature: signature.data,
        senderAddress: this.#account.address,
      });
      return `Successfully proposed adding signer ${newSigner} to Safe ${this.#safeAddress}. Safe transaction hash: ${safeTxHash}. The other signers will need to confirm the transaction before it can be executed.`;
    } else {
      // Single-sig flow: execute immediately
      const tx = await this.#safeClient.executeTransaction(safeTransaction);
      return `Successfully added signer ${newSigner} to Safe ${this.#safeAddress}. Threshold: ${newThreshold}. Transaction hash: ${tx.hash}.`;
    }
  }

  /**
   * Removes an owner from the Safe.
   *
   * @param signerToRemove - The address of the owner to remove.
   * @param newThreshold - Optional new threshold after removing the owner.
   * @returns Transaction hash
   */
  async removeOwnerWithThreshold(signerToRemove: string, newThreshold?: number): Promise<string> {
    if (!this.#safeClient) throw new Error("Safe client is not set.");

    // Get current Safe settings
    const currentOwners = await this.getOwners();
    const currentThreshold = await this.getThreshold();

    // Validate we're not removing the last owner
    if (currentOwners.length <= 1) {
      throw new Error("Cannot remove the last owner");
    }

    // Determine new threshold (keep current if valid, otherwise reduce)
    newThreshold =
      newThreshold ||
      (currentThreshold > currentOwners.length - 1 ? currentOwners.length - 1 : currentThreshold);

    // Validate threshold
    if (newThreshold > currentOwners.length - 1) {
      throw new Error(
        `Invalid threshold: ${newThreshold} cannot be greater than number of remaining owners (${currentOwners.length - 1})`,
      );
    }
    if (newThreshold < 1) throw new Error("Threshold must be at least 1");

    // Create transaction to remove owner
    const safeTransaction = await this.#safeClient.createRemoveOwnerTx({
      ownerAddress: signerToRemove,
      threshold: newThreshold,
    });

    if (currentThreshold > 1) {
      // Multi-sig flow: propose transaction
      const safeTxHash = await this.#safeClient.getTransactionHash(safeTransaction);
      const signature = await this.#safeClient.signHash(safeTxHash);

      await this.#apiKit.proposeTransaction({
        safeAddress: this.getAddress(),
        safeTransactionData: safeTransaction.data,
        safeTxHash,
        senderSignature: signature.data,
        senderAddress: this.#account.address,
      });
      return `Successfully proposed removing signer ${signerToRemove} from Safe ${this.#safeAddress}. Safe transaction hash: ${safeTxHash}. The other signers will need to confirm the transaction before it can be executed.`;
    } else {
      // Single-sig flow: execute immediately
      const tx = await this.#safeClient.executeTransaction(safeTransaction);
      return `Successfully removed signer ${signerToRemove} from Safe ${this.#safeAddress}. Transaction hash: ${tx.hash}.`;
    }
  }

  /**
   * Changes the threshold of the Safe.
   *
   * @param newThreshold - The new threshold value.
   * @returns Transaction hash
   */
  async changeThreshold(newThreshold: number): Promise<string> {
    if (!this.#safeClient) throw new Error("Safe client is not set.");

    // Get current Safe settings
    const currentOwners = await this.getOwners();
    const currentThreshold = await this.getThreshold();

    // Validate new threshold
    if (newThreshold > currentOwners.length) {
      throw new Error(
        `Invalid threshold: ${newThreshold} cannot be greater than number of owners (${currentOwners.length})`,
      );
    }
    if (newThreshold < 1) throw new Error("Threshold must be at least 1");

    // Create transaction to change threshold
    const safeTransaction = await this.#safeClient.createChangeThresholdTx(newThreshold);

    if (currentThreshold > 1) {
      // Multi-sig flow: propose transaction
      const safeTxHash = await this.#safeClient.getTransactionHash(safeTransaction);
      const signature = await this.#safeClient.signHash(safeTxHash);

      await this.#apiKit.proposeTransaction({
        safeAddress: this.getAddress(),
        safeTransactionData: safeTransaction.data,
        safeTxHash,
        senderSignature: signature.data,
        senderAddress: this.#account.address,
      });
      return `Successfully proposed changing threshold to ${newThreshold} for Safe ${this.#safeAddress}. Safe transaction hash: ${safeTxHash}. The other signers will need to confirm the transaction before it can be executed.`;
    } else {
      // Single-sig flow: execute immediately
      const tx = await this.#safeClient.executeTransaction(safeTransaction);
      return `Successfully changed threshold to ${newThreshold} for Safe ${this.#safeAddress}. Transaction hash: ${tx.hash}.`;
    }
  }

  /**
   * Approves and optionally executes a pending transaction for the Safe.
   *
   * @param safeTxHash - The transaction hash to approve/execute
   * @param executeImmediately - Whether to execute the transaction if all signatures are collected (default: true)
   * @returns A message containing the approval/execution details
   */
  async approvePendingTransaction(
    safeTxHash: string,
    executeImmediately: boolean = true,
  ): Promise<string> {
    if (!this.#safeClient) throw new Error("Safe client is not set.");

    try {
      // Get pending transactions
      const pendingTxs = await this.#apiKit.getPendingTransactions(this.getAddress());

      // Find the specific transaction
      const tx = pendingTxs.results.find(tx => tx.safeTxHash === safeTxHash);

      if (!tx) {
        return `No pending transaction found with hash: ${safeTxHash}`;
      }

      if (tx.isExecuted) {
        return `Transaction ${safeTxHash} has already been executed`;
      }

      // Check if agent has already signed
      const agentAddress = this.#account.address;
      const hasAgentSigned = tx.confirmations?.some(
        c => c.owner.toLowerCase() === agentAddress.toLowerCase(),
      );
      const confirmations = tx.confirmations?.length || 0;

      // If agent hasn't signed yet, sign the transaction
      if (!hasAgentSigned) {
        const signature = await this.#safeClient.signHash(safeTxHash);
        await this.#apiKit.confirmTransaction(safeTxHash, signature.data);

        // If this was the last required signature and executeImmediately is true, execute
        if (confirmations + 1 >= tx.confirmationsRequired && executeImmediately) {
          const executedTx = await this.#safeClient.executeTransaction(tx);
          return `Successfully approved and executed transaction. Safe transaction hash: ${safeTxHash}. Execution transaction hash: ${executedTx.hash}`;
        }

        return `Successfully approved transaction ${safeTxHash}. Current confirmations: ${confirmations + 1}/${tx.confirmationsRequired}${
          confirmations + 1 >= tx.confirmationsRequired
            ? ". Transaction can now be executed"
            : ". Other owners will need to approve the transaction before it can be executed"
        }`;
      }

      // If agent has already signed and there are enough confirmations, execute if requested
      if (confirmations >= tx.confirmationsRequired && executeImmediately) {
        const executedTx = await this.#safeClient.executeTransaction(tx);
        return `Successfully executed transaction. Safe transaction hash: ${safeTxHash}. Execution transaction hash: ${executedTx.hash}`;
      }

      return `Transaction ${safeTxHash} already approved. Current confirmations: ${confirmations}/${tx.confirmationsRequired}${
        confirmations >= tx.confirmationsRequired
          ? ". Transaction can now be executed"
          : ". Other owners will need to approve the transaction before it can be executed"
      }`;
    } catch (error) {
      throw new Error(
        `Error approving/executing transaction: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Enables the allowance module for the Safe.
   *
   * @returns A message indicating success or failure
   */
  async enableAllowanceModule(): Promise<string> {
    if (!this.#safeClient) throw new Error("Safe client is not set.");

    try {
      // Get allowance module address for current chain
      const chainId = this.#chain.id.toString();
      const allowanceModule = getAllowanceModuleDeployment({ network: chainId });
      if (!allowanceModule) {
        throw new Error(`Allowance module not found for chainId [${chainId}]`);
      }

      // Check if module is already enabled
      const moduleAddress = allowanceModule.networkAddresses[chainId];
      const isAlreadyEnabled = await this.#safeClient.isModuleEnabled(moduleAddress);
      if (isAlreadyEnabled) {
        return "Allowance module is already enabled for this Safe";
      }

      // Create transaction to enable module
      const safeTransaction = await this.#safeClient.createEnableModuleTx(moduleAddress);
      const currentThreshold = await this.#safeClient.getThreshold();

      if (currentThreshold > 1) {
        // Multi-sig flow: propose transaction
        const safeTxHash = await this.#safeClient.getTransactionHash(safeTransaction);
        const signature = await this.#safeClient.signHash(safeTxHash);

        await this.#apiKit.proposeTransaction({
          safeAddress: this.getAddress(),
          safeTransactionData: safeTransaction.data,
          safeTxHash,
          senderSignature: signature.data,
          senderAddress: this.#account.address,
        });

        return `Successfully proposed enabling allowance module for Safe ${this.#safeAddress}. Safe transaction hash: ${safeTxHash}. The other signers will need to confirm the transaction before it can be executed.`;
      } else {
        // Single-sig flow: execute immediately
        const tx = await this.#safeClient.executeTransaction(safeTransaction);
        return `Successfully enabled allowance module for Safe ${this.#safeAddress}. Transaction hash: ${tx.hash}.`;
      }
    } catch (error) {
      throw new Error(
        `Failed to enable allowance module: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Sets an allowance for a delegate to spend tokens from the Safe.
   *
   * @param delegateAddress - Address that will receive the allowance
   * @param tokenAddress - Address of the ERC20 token
   * @param amount - Amount of tokens to allow (e.g. '1.5' for 1.5 tokens)
   * @param resetTimeInMinutes - Time in minutes after which the allowance resets, e.g 1440 for 24 hours (optional, defaults to 0 for one-time allowance)
   * @returns A message containing the allowance setting details
   */
  async setAllowance(
    delegateAddress: string,
    tokenAddress: string | undefined,
    amount: string,
    resetTimeInMinutes: number | undefined,
  ): Promise<string> {
    if (!this.#safeClient) throw new Error("Safe client is not set.");

    try {
      // Get allowance module for current chain
      const chainId = this.#chain.id.toString();
      const allowanceModule = getAllowanceModuleDeployment({ network: chainId });
      if (!allowanceModule) {
        throw new Error(`Allowance module not found for chainId [${chainId}]`);
      }

      const moduleAddress = allowanceModule.networkAddresses[chainId];

      // Check if module is enabled
      const isModuleEnabled = await this.#safeClient.isModuleEnabled(moduleAddress);
      if (!isModuleEnabled) {
        throw new Error("Allowance module is not enabled for this Safe. Enable it first.");
      }

      // Get token symbol
      const tokenSymbol = await this.readContract({
        address: tokenAddress as Hex,
        abi: ERC20_ABI,
        functionName: "symbol",
      });

      // Get token decimals and convert amount
      const tokenDecimals = await this.readContract({
        address: tokenAddress as Hex,
        abi: ERC20_ABI,
        functionName: "decimals",
      });

      // Convert amount to token decimals
      const amountBigInt = parseUnits(amount, Number(tokenDecimals));

      // Check if the address is already a delegate
      let isDelegate = false;
      try {
        // Use getDelegates function to get the list of delegates
        const [delegates] = (await this.readContract({
          address: moduleAddress as Hex,
          abi: allowanceModule.abi,
          functionName: "getDelegates",
          args: [this.getAddress(), 0, 100], // Start from 0, get up to 100 delegates
        })) as [string[], bigint];

        // Check if delegateAddress is in the list of delegates
        isDelegate = delegates.some(
          delegate => delegate.toLowerCase() === delegateAddress.toLowerCase(),
        );
      } catch (error) {
        console.log("Error checking delegates:", error);
        // If the call fails, assume not a delegate
        isDelegate = false;
      }

      // Add delegate (if not already a delegate)
      const addDelegateData = encodeFunctionData({
        abi: allowanceModule.abi,
        functionName: "addDelegate",
        args: [delegateAddress],
      });

      // Prepare the setAllowance transaction data
      const setAllowanceData = encodeFunctionData({
        abi: allowanceModule.abi,
        functionName: "setAllowance",
        args: [
          delegateAddress,
          tokenAddress,
          amountBigInt,
          BigInt(resetTimeInMinutes || 0), // Use 0 for one-time allowance if not specified
          BigInt(0), // resetBaseMin (0 is fine as default)
        ],
      });

      // Create transaction
      const safeTransaction = await this.#safeClient.createTransaction({
        transactions: isDelegate
          ? [
              // If already a delegate, only set allowance
              {
                to: moduleAddress,
                value: "0",
                data: setAllowanceData,
              },
            ]
          : [
              // If not a delegate, first add as delegate then set allowance
              {
                to: moduleAddress,
                value: "0",
                data: addDelegateData,
              },
              {
                to: moduleAddress,
                value: "0",
                data: setAllowanceData,
              },
            ],
      });

      const currentThreshold = await this.#safeClient.getThreshold();

      // Update success message to include reset time info
      const resetTimeMsg =
        resetTimeInMinutes && resetTimeInMinutes > 0
          ? ` (resets every ${resetTimeInMinutes} minutes)`
          : ` (one-time allowance)`;

      const delegateMsg = !isDelegate ? "adding delegate and " : "";

      if (currentThreshold > 1) {
        // Multi-sig flow: propose transaction
        const safeTxHash = await this.#safeClient.getTransactionHash(safeTransaction);
        const signature = await this.#safeClient.signHash(safeTxHash);

        await this.#apiKit.proposeTransaction({
          safeAddress: this.getAddress(),
          safeTransactionData: safeTransaction.data,
          safeTxHash,
          senderSignature: signature.data,
          senderAddress: this.#account.address,
        });

        return `Successfully proposed ${delegateMsg}setting allowance of ${amount} ${tokenSymbol} (${tokenAddress})${resetTimeMsg} for delegate ${delegateAddress}. Safe transaction hash: ${safeTxHash}. The other signers will need to confirm the transaction before it can be executed.`;
      } else {
        // Single-sig flow: execute immediately
        const tx = await this.#safeClient.executeTransaction(safeTransaction);
        return `Successfully ${delegateMsg}set allowance of ${amount} ${tokenSymbol} (${tokenAddress})${resetTimeMsg} for delegate ${delegateAddress}. Transaction hash: ${tx.hash}.`;
      }
    } catch (error) {
      throw new Error(
        `Error setting allowance: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Override walletProvider's trackInitialization to prevent tracking before Safe is initialized.
   * Only tracks analytics after the Safe is fully set up.
   */
  protected trackInitialization(): void {
    // Only track if fully initialized
    if (!this.#isInitialized) return;
    super.trackInitialization();
  }

  /**
   * Creates or connects to a Safe, depending on whether safeAddr is defined.
   *
   * @param safeAddr - The existing Safe address (if not provided, a new Safe is deployed).
   * @returns The address of the Safe.
   */
  private async initializeSafe(safeAddr?: string): Promise<string> {
    if (!safeAddr) {
      // Check if account has enough ETH for gas fees
      const balance = await this.#publicClient.getBalance({ address: this.#account.address });
      if (balance === BigInt(0))
        throw new Error(
          "Creating Safe account requires gaas fees. Please ensure you have enough ETH in your wallet.",
        );

      // Deploy a new Safe
      const predictedSafe = {
        safeAccountConfig: {
          owners: [this.#account.address],
          threshold: 1,
        },
        safeDeploymentConfig: {
          saltNonce: BigInt(Date.now()).toString(),
        },
      };

      const safeSdk = await Safe.init({
        provider: this.#publicClient.transport,
        signer: this.#privateKey,
        predictedSafe,
      });

      // Prepare and send deployment transaction
      const deploymentTx = await safeSdk.createSafeDeploymentTransaction();
      const externalSigner = await safeSdk.getSafeProvider().getExternalSigner();
      const hash = await externalSigner?.sendTransaction({
        to: deploymentTx.to,
        value: BigInt(deploymentTx.value),
        data: deploymentTx.data as Hex,
        chain: this.#publicClient.chain,
      });
      await this.waitForTransactionReceipt(hash as Hex);

      // Reconnect to the deployed Safe
      const safeAddress = await safeSdk.getAddress();
      const reconnected = await safeSdk.connect({ safeAddress });
      this.#safeClient = reconnected;
      this.#safeAddress = safeAddress;

      return safeAddress;
    } else {
      // Connect to an existing Safe
      const safeSdk = await Safe.init({
        provider: this.#publicClient.transport,
        signer: this.#privateKey,
        safeAddress: safeAddr,
      });
      this.#safeClient = safeSdk;
      const existingAddress = await safeSdk.getAddress();

      return existingAddress;
    }
  }
}
