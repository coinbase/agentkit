import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { InitializeSafeSchema, SafeInfoSchema, AddSignerSchema, RemoveSignerSchema, ChangeThresholdSchema, ExecutePendingSchema, WithdrawFromSafeSchema, EnableAllowanceModuleSchema, AnalyzeTransactionSchema } from "./schemas";
import { Wallet, JsonRpcProvider } from "ethers";
import { Network } from "../../network";
import { base, baseSepolia, sepolia } from "viem/chains";
import Safe, { PredictedSafeProps } from '@safe-global/protocol-kit'
import SafeApiKit from '@safe-global/api-kit'
import { getAllowanceModuleDeployment } from '@safe-global/safe-modules-deployments'
import { EvmWalletProvider } from "../../wallet-providers/evmWalletProvider";
import { NETWORK_ID_TO_VIEM_CHAIN } from "../../network/network";
import { waitForTransactionReceipt } from "viem/actions";

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
 * NetworkConfig is the configuration for network-specific settings.
 */
interface NetworkConfig {
  rpcUrl: string;
  chain: string;
}

interface TenderlySimulationResponse {
  success: boolean;
  error?: string;
  gasUsed?: string;
  logs?: Array<{
    name: string;
    topics: string[];
  }>;
}

async function simulateWithTenderly(tx: any, network: string): Promise<TenderlySimulationResponse> {
  const TENDERLY_USER = process.env.TENDERLY_USER;
  const TENDERLY_PROJECT = process.env.TENDERLY_PROJECT;
  const TENDERLY_ACCESS_KEY = process.env.TENDERLY_ACCESS_KEY;

  if (!TENDERLY_USER || !TENDERLY_PROJECT || !TENDERLY_ACCESS_KEY) {
    return { success: false, error: "Tenderly credentials not configured" };
  }

  try {
    const response = await fetch(
      `https://api.tenderly.co/api/v1/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/simulate`,
      {
        method: "POST",
        headers: {
          "X-Access-Key": TENDERLY_ACCESS_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          network_id: network,
          from: tx.proposer,
          to: tx.to,
          input: tx.data,
          value: tx.value,
          save: true,
        }),
      }
    );

    const result = await response.json();
    return {
      success: result.simulation.status,
      gasUsed: result.simulation.gas_used,
      logs: result.simulation.logs,
      error: result.simulation.error_message
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Simulation failed" 
    };
  }
}

/**
 * SafeActionProvider is an action provider for Safe smart account interactions.
 */
export class SafeActionProvider extends ActionProvider<EvmWalletProvider> {
  private walletWithProvider: Wallet;
  private safeClient: Safe | null = null;
  private readonly networkConfig: NetworkConfig;
  private readonly privateKey: string;
  private apiKit: SafeApiKit;

  /**
   * Constructor for the SafeActionProvider class.
   *
   * @param config - The configuration options for the SafeActionProvider.
   */
  constructor(config: SafeActionProviderConfig = {}) {
    super("safe", []);

    // Get Viem chain object for the network
    const viemChain = NETWORK_ID_TO_VIEM_CHAIN[config.networkId || "base-sepolia"];
    if (!viemChain) {
      throw new Error(`Unsupported network: ${config.networkId}`);
    }
    console.log("viemChain: ", viemChain);

    // Use Viem chain's RPC URL and name
    this.networkConfig = {
      rpcUrl: viemChain.rpcUrls.default.http[0],
      chain: config.networkId || "base-sepolia"
    };
    console.log("networkConfig: ", this.networkConfig);
    // if (!this.supportsNetwork({ networkId: this.networkConfig.chain })) {
    //   throw new Error("Unsupported network. Only base-sepolia, ethereum-sepolia, and base-mainnet are supported.");
    // }

    const privateKey = config.privateKey || process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("Private key is not configured");
    }

    const provider = new JsonRpcProvider(this.networkConfig.rpcUrl);
    const walletWithProvider = new Wallet(privateKey, provider);
    this.walletWithProvider = walletWithProvider;
    this.privateKey = privateKey;

    // Initialize apiKit with chain ID from Viem chain
    this.apiKit = new SafeApiKit({
      chainId: BigInt(viemChain.id)
    });
  }

  /**
   * Initializes a new Safe smart account.
   *
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
  async initializeSafe(args: z.infer<typeof InitializeSafeSchema>): Promise<string> {

    try {
        const predictedSafe: PredictedSafeProps = {
                safeAccountConfig: {
                owners: [this.walletWithProvider.address],
                threshold: 1
                 },
                 safeDeploymentConfig: {
                    saltNonce: BigInt(Date.now()).toString()
                 }
            }

        let protocolKit = await Safe.init({
            provider: this.networkConfig.rpcUrl,
            signer: this.privateKey,
            predictedSafe
        });

        const safeAddress = await protocolKit.getAddress();
        console.log("safeAddress", safeAddress);

        const deploymentTransaction = await protocolKit.createSafeDeploymentTransaction()

        // Execute transaction 
        const client = await protocolKit.getSafeProvider().getExternalSigner()
        const txHash = await client?.sendTransaction({
            to: deploymentTransaction.to,
            value: BigInt(deploymentTransaction.value),
            data: deploymentTransaction.data as `0x${string}`,
            chain: this.networkConfig.chain === "base-sepolia" ? baseSepolia : this.networkConfig.chain === "ethereum-sepolia" ? sepolia : base
        })
        console.log("txHash: ", txHash);

        const address = client!.account.address
        const txReceipt = await waitForTransactionReceipt(client!, { hash: txHash! });
        console.log("txReceipt: ", txReceipt);

        // Reconnect to newly deployed Safe 
        protocolKit = await protocolKit.connect({ safeAddress })
        this.safeClient = protocolKit;

        console.log('Is Safe deployed:', await protocolKit.isSafeDeployed())
        console.log('Safe Address:', await protocolKit.getAddress())
        console.log('Safe Owners:', await protocolKit.getOwners())
        console.log('Safe Threshold:', await protocolKit.getThreshold())
        
        return `Successfully created Safe at address ${safeAddress} with signers ${args.signers} and threshold of ${args.threshold}.`;
    } catch (error) {
        return `Error creating Safe: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Connects to an existing Safe smart account.
   *
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
  async safeInfo(args: z.infer<typeof SafeInfoSchema>): Promise<string> {
    try {
      const protocolKit = await Safe.init({
        provider: this.networkConfig.rpcUrl,
        signer: this.privateKey,
        safeAddress: args.safeAddress
      });

      const owners = await protocolKit.getOwners();
      const threshold = await protocolKit.getThreshold();
      const pendingTransactions = await this.apiKit.getPendingTransactions(args.safeAddress);
      const balance = await this.walletWithProvider.provider?.getBalance(args.safeAddress);
      const ethBalance = balance ? parseFloat(balance.toString()) / 1e18 : 0; 

      console.log("pendingTransactions: ", pendingTransactions);

      const pendingTxDetails = pendingTransactions.results
        .filter(tx => !tx.isExecuted)
        .map(tx => {
          const confirmations = tx.confirmations?.length || 0;
          const needed = tx.confirmationsRequired;
          const confirmedBy = tx.confirmations?.map(c => c.owner).join(', ') || 'none';
          return `\n- Transaction ${tx.safeTxHash} (${confirmations}/${needed} confirmations, confirmed by: ${confirmedBy})`;
        })
        .join('');

      return `Safe at address ${args.safeAddress}:
- Balance: ${ethBalance.toFixed(5)} ETH
- ${owners.length} owners: ${owners.join(', ')}
- Threshold: ${threshold}
- Pending transactions: ${pendingTransactions.count}${pendingTxDetails}`;
    } catch (error) {
      return `Error connecting to Safe: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

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
  async addSigner(args: z.infer<typeof AddSignerSchema>): Promise<string> {
    try {
      // Connect to existing safe
      const protocolKit = await Safe.init({
        provider: this.networkConfig.rpcUrl,
        signer: this.privateKey,
        safeAddress: args.safeAddress
      });

      // Get current signers and threshold
      const currentSigners = await protocolKit.getOwners();
      const currentThreshold = await protocolKit.getThreshold();
      
      // Add new signer
      const safeTransaction = await protocolKit.createAddOwnerTx({
        ownerAddress: args.newSigner,
        threshold: args.newThreshold || currentThreshold
      });

      if (currentThreshold > 1) {
        // Multi-sig flow: propose transaction
        const safeTxHash = await protocolKit.getTransactionHash(safeTransaction);
        const signature = await protocolKit.signHash(safeTxHash);

        const txResponse = await this.apiKit.proposeTransaction({
          safeAddress: args.safeAddress,
          safeTransactionData: safeTransaction.data,
          safeTxHash,
          senderSignature: signature.data,
          senderAddress: this.walletWithProvider.address
        });

        return `Successfully proposed adding signer ${args.newSigner} to Safe ${args.safeAddress}. Transaction hash: ${safeTxHash}. The other signers will need to confirm the transaction before it can be executed.`;
      } 
      
      else {
        // Single-sig flow: execute immediately
        const txResponse = await protocolKit.executeTransaction(safeTransaction);
        console.log("txResponse: ", txResponse);
        return `Successfully added signer ${args.newSigner} to Safe ${args.safeAddress}.`;
      }
    } catch (error) {
      return `Error adding signer: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

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
  async removeSigner(args: z.infer<typeof RemoveSignerSchema>): Promise<string> {
    try {
      const protocolKit = await Safe.init({
        provider: this.networkConfig.rpcUrl,
        signer: this.privateKey,
        safeAddress: args.safeAddress
      });

      const currentSigners = await protocolKit.getOwners();
      const currentThreshold = await protocolKit.getThreshold();
      
      if (currentSigners.length <= 1) {
        throw new Error("Cannot remove the last signer");
      }

      const safeTransaction = await protocolKit.createRemoveOwnerTx({
        ownerAddress: args.signerToRemove,
        threshold: args.newThreshold || (currentThreshold > currentSigners.length - 1 ? currentSigners.length - 1 : currentThreshold)
      });

      if (currentThreshold > 1) {
        // Multi-sig flow: propose transaction
        const safeTxHash = await protocolKit.getTransactionHash(safeTransaction);
        const signature = await protocolKit.signHash(safeTxHash);
        
        await this.apiKit.proposeTransaction({
          safeAddress: args.safeAddress,
          safeTransactionData: safeTransaction.data,
          safeTxHash,
          senderSignature: signature.data,
          senderAddress: this.walletWithProvider.address
        });

        return `Successfully proposed removing signer ${args.signerToRemove} from Safe ${args.safeAddress}. Transaction hash: ${safeTxHash}. The other signers will need to confirm the transaction before it can be executed.`;
      } else {
        // Single-sig flow: execute immediately
        const txResponse = await protocolKit.executeTransaction(safeTransaction);
        console.log("txResponse: ", txResponse);
        return `Successfully removed signer ${args.signerToRemove} from Safe ${args.safeAddress}`;
      }
    } catch (error) {
      return `Error removing signer: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

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
  async changeThreshold(args: z.infer<typeof ChangeThresholdSchema>): Promise<string> {
    try {
      const protocolKit = await Safe.init({
        provider: this.networkConfig.rpcUrl,
        signer: this.privateKey,
        safeAddress: args.safeAddress
      });

      const currentSigners = await protocolKit.getOwners();
      const currentThreshold = await protocolKit.getThreshold();
      
      if (args.newThreshold > currentSigners.length) {
        throw new Error("New threshold cannot exceed number of signers");
      }

      const safeTransaction = await protocolKit.createChangeThresholdTx(args.newThreshold);

      if (currentThreshold > 1) {
        // Multi-sig flow: propose transaction
        const safeTxHash = await protocolKit.getTransactionHash(safeTransaction);
        const signature = await protocolKit.signHash(safeTxHash);
        
        await this.apiKit.proposeTransaction({
          safeAddress: args.safeAddress,
          safeTransactionData: safeTransaction.data,
          safeTxHash,
          senderSignature: signature.data,
          senderAddress: this.walletWithProvider.address
        });

        return `Successfully proposed changing threshold to ${args.newThreshold} for Safe ${args.safeAddress}. Transaction hash: ${safeTxHash}. The other signers will need to confirm the transaction before it can be executed.`;
      } else {
        // Single-sig flow: execute immediately
        const txResponse = await protocolKit.executeTransaction(safeTransaction);
        console.log("txResponse: ", txResponse);
        return `Successfully changed threshold to ${args.newThreshold} for Safe ${args.safeAddress}`;
      }
    } catch (error) {
      return `Error changing threshold: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

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
  async executePending(args: z.infer<typeof ExecutePendingSchema>): Promise<string> {
    try {
      const protocolKit = await Safe.init({
        provider: this.networkConfig.rpcUrl,
        signer: this.privateKey,
        safeAddress: args.safeAddress
      });

      const pendingTxs = await this.apiKit.getPendingTransactions(args.safeAddress);
      
      if (pendingTxs.results.length === 0) {
        return "No pending transactions found.";
      }

      let executedTxs = 0;
      let skippedTxs = 0;
      const txsToProcess = args.safeTxHash 
        ? pendingTxs.results.filter(tx => tx.safeTxHash === args.safeTxHash && tx.isExecuted === false)
        : pendingTxs.results.filter(tx => tx.isExecuted === false);

      for (const tx of txsToProcess) {
        try {
          // Skip if not enough confirmations
          console.log("tx.confirmations: ", tx.confirmations);
          if (tx.confirmations && tx.confirmations.length < tx.confirmationsRequired) {
            console.log(`Transaction ${tx.safeTxHash} needs ${tx.confirmationsRequired} confirmations but only has ${tx.confirmations?.length}.`);
            skippedTxs++;
            continue;
          }
          const txResponse = await protocolKit.executeTransaction(tx);
          console.log(`Executed transaction ${tx.safeTxHash}:`, txResponse);
          executedTxs++;
        } catch (error) {
          console.error(`Failed to execute ${tx.safeTxHash}:`, error);
          skippedTxs++;
        }
      }

      if (executedTxs === 0 && skippedTxs > 0) {
        return `No transactions executed. ${skippedTxs} transaction(s) have insufficient confirmations.`;
      }

      return `Execution complete. Successfully executed ${executedTxs} transaction(s)${skippedTxs > 0 ? `, ${skippedTxs} still pending and need more confirmations` : ''}.${
        args.safeTxHash ? ` Transaction hash: ${args.safeTxHash}` : ''
      }`;
    } catch (error) {
      return `Error executing transactions: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

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
  async withdrawEth(args: z.infer<typeof WithdrawFromSafeSchema>): Promise<string> {
    try {
      const protocolKit = await Safe.init({
        provider: this.networkConfig.rpcUrl,
        signer: this.privateKey,
        safeAddress: args.safeAddress
      });

      const currentThreshold = await protocolKit.getThreshold();
      const balance = await this.walletWithProvider.provider?.getBalance(args.safeAddress);
      if (!balance) throw new Error("Could not get Safe balance");

      // Calculate amount to withdraw
      let withdrawAmount: bigint;
      if (args.amount) {
        withdrawAmount = BigInt(Math.floor(parseFloat(args.amount) * 1e18));
        if (withdrawAmount > balance) {
          throw new Error(`Insufficient balance. Safe has ${parseFloat(balance.toString()) / 1e18} ETH`);
        }
      } else {
        withdrawAmount = balance;
      }

      const safeTransaction = await protocolKit.createTransaction({
        transactions: [{
          to: args.recipientAddress,
          data: "0x",
          value: withdrawAmount.toString()
        }]
      });

      if (currentThreshold > 1) {
        // Multi-sig flow: propose transaction
        const safeTxHash = await protocolKit.getTransactionHash(safeTransaction);
        const signature = await protocolKit.signHash(safeTxHash);
        
        await this.apiKit.proposeTransaction({
          safeAddress: args.safeAddress,
          safeTransactionData: safeTransaction.data,
          safeTxHash,
          senderSignature: signature.data,
          senderAddress: this.walletWithProvider.address
        });

        return `Successfully proposed withdrawing ${parseFloat(withdrawAmount.toString()) / 1e18} ETH to ${args.recipientAddress}. Transaction hash: ${safeTxHash}. The other signers will need to confirm the transaction before it can be executed.`;
      } else {
        // Single-sig flow: execute immediately
        const txResponse = await protocolKit.executeTransaction(safeTransaction);
        console.log("txResponse: ", txResponse);
        return `Successfully withdrew ${parseFloat(withdrawAmount.toString()) / 1e18} ETH to ${args.recipientAddress}`;
      }
    } catch (error) {
      return `Error withdrawing ETH: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

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
  async enableAllowanceModule(args: z.infer<typeof EnableAllowanceModuleSchema>): Promise<string> {
    try {
      const protocolKit = await Safe.init({
        provider: this.networkConfig.rpcUrl,
        signer: this.privateKey,
        safeAddress: args.safeAddress
      });

      const isSafeDeployed = await protocolKit.isSafeDeployed();
      if (!isSafeDeployed) {
        throw new Error("Safe not deployed");
      }

      // Get allowance module address for current chain
    //   const chainId = baseSepolia.id.toString();
    const chainId = sepolia.id.toString();
      const allowanceModule = getAllowanceModuleDeployment({ network: chainId });
      if (!allowanceModule) {
        throw new Error(`Allowance module not found for chainId [${chainId}]`);
      }

      // Check if module is already enabled
      const moduleAddress = allowanceModule.networkAddresses[chainId];
      const isAlreadyEnabled = await protocolKit.isModuleEnabled(moduleAddress);
      if (isAlreadyEnabled) {
        return "Allowance module is already enabled for this Safe";
      }

      // Create and execute/propose transaction
      const safeTransaction = await protocolKit.createEnableModuleTx(moduleAddress);
      const currentThreshold = await protocolKit.getThreshold();

      if (currentThreshold > 1) {
        // Multi-sig flow: propose transaction
        const safeTxHash = await protocolKit.getTransactionHash(safeTransaction);
        const signature = await protocolKit.signHash(safeTxHash);
        
        await this.apiKit.proposeTransaction({
          safeAddress: args.safeAddress,
          safeTransactionData: safeTransaction.data,
          safeTxHash,
          senderSignature: signature.data,
          senderAddress: this.walletWithProvider.address
        });

        return `Successfully proposed enabling allowance module for Safe ${args.safeAddress}. Transaction hash: ${safeTxHash}. The other signers will need to confirm the transaction before it can be executed.`;
      } else {
        // Single-sig flow: execute immediately
        const txResponse = await protocolKit.executeTransaction(safeTransaction);
        console.log("txResponse: ", txResponse);
        return `Successfully enabled allowance module for Safe ${args.safeAddress}`;
      }
    } catch (error) {
      return `Error enabling allowance module: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  @CreateAction({
    name: "analyze_transaction",
    description: `
Analyzes a pending Safe transaction to explain what it does.
Takes the following inputs:
- safeAddress: Address of the Safe
- safeTxHash: Hash of the transaction to analyze

Returns a detailed analysis including:
- Who proposed it and when
- Current confirmation status
- What the transaction will do if executed
- Any risk considerations
`,
    schema: AnalyzeTransactionSchema,
  })
  async analyzeTransaction(args: z.infer<typeof AnalyzeTransactionSchema>): Promise<string> {
    try {
      // Get transaction details
      const pendingTxs = await this.apiKit.getPendingTransactions(args.safeAddress);
      const tx = pendingTxs.results.find(tx => tx.safeTxHash === args.safeTxHash);
      console.log("tx: ", tx);
      
      if (!tx) {
        return `Transaction ${args.safeTxHash} not found in pending transactions.`;
      }

      // Analyze the transaction
      const proposedAt = new Date(tx.submissionDate).toLocaleString();
      const confirmations = tx.confirmations?.length || 0;
      const confirmationStatus = `${confirmations}/${tx.confirmationsRequired} confirmations`;

      // Get known addresses from delegates and common contracts
      const knownAddresses = new Map<string, string>();

      // Add well-known contracts
      const commonContracts: Record<string, string> = {
        "0x3E5c63644E683549055b9Be8653de26E0B4CD36E": "Safe Singleton v1.3.0",
        "0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552": "Safe Singleton v1.3.0",
        "0x69f4D1788e39c87893C980c06EdF4b7f686e2938": "Safe Allowance Module",
        // Add more known contracts here
      };

      // Add common contracts to known addresses
      Object.entries(commonContracts).forEach(([address, name]) => {
        knownAddresses.set(address.toLowerCase(), name);
      });

      // Get delegates if any
      try {
        const delegates = await this.apiKit.getSafeDelegates({
          safeAddress: args.safeAddress,
          limit: 100
        });
        
        // Add delegates to known addresses
        delegates.results.forEach(delegate => {
          knownAddresses.set(delegate.delegate.toLowerCase(), `Delegate (added by ${delegate.delegator})`);
        });
      } catch (error) {
        console.error("Error fetching delegates:", error);
      }

      // Helper function to get readable address
      const getAddressName = (address: string) => knownAddresses.get(address.toLowerCase()) || address;

      // Update proposer and confirmations with known names
      const proposerName = tx.proposer ? getAddressName(tx.proposer) : 'unknown';
      const confirmedBy = tx.confirmations?.map(c => getAddressName(c.owner)).join(', ') || 'none';

      // Analyze transaction type and data
      let actionDescription = "Unknown transaction type";
      if (tx.dataDecoded) {
        console.log("tx.dataDecoded: ", tx.dataDecoded);
        
        const method = tx.dataDecoded.method;
        const params = tx.dataDecoded.parameters;
        
        // Decode common transaction types
        switch (method) {
          case "addOwnerWithThreshold":
            actionDescription = `Add new owner ${params?.[0].value} with threshold ${params?.[1].value}`;
            break;
          case "removeOwner":
            actionDescription = `Remove owner ${params?.[1].value} and change threshold to ${params?.[2].value}`;
            break;
          case "changeThreshold":
            actionDescription = `Change confirmation threshold to ${params?.[0].value}`;
            break;
          case "enableModule":
            actionDescription = `Enable module at address ${params?.[0].value}`;
            break;
          default:
            if (tx.value !== "0") {
              actionDescription = `Transfer ${parseFloat(tx.value) / 1e18} ETH to ${tx.to}`;
            } else {
              actionDescription = `Call method '${method}' on contract ${tx.to}`;
            }
        }
      } else if (tx.value !== "0") {
        actionDescription = `Transfer ${parseFloat(tx.value) / 1e18} ETH to ${tx.to}`;
      }

      // Add risk analysis section
      const riskFactors: string[] = [];
      
      // 1. Check if this changes Safe configuration
      if (tx.dataDecoded?.method.includes("Owner") || tx.dataDecoded?.method === "changeThreshold") {
        riskFactors.push("⚠️ This transaction modifies Safe ownership/configuration");
      }

      // 2. Check value transfer risks
      if (tx.value !== "0") {
        const ethValue = parseFloat(tx.value) / 1e18;
        const balance = await this.walletWithProvider.provider?.getBalance(args.safeAddress);
        const safeBalance = balance ? parseFloat(balance.toString()) / 1e18 : 0;
        
        if (ethValue > safeBalance * 0.5) {
          riskFactors.push(`⚠️ High-value transfer: ${ethValue} ETH (>${Math.round(ethValue/safeBalance*100)}% of Safe balance)`);
        }
      }

      // 3. Check destination address
      if (tx.to) {
        // Check if destination is a contract
        const code = await this.walletWithProvider.provider?.getCode(tx.to);
        const isContract = code && code !== "0x";
        
        // Check if it's a known contract (could expand this list)
        const knownContracts: Record<string, string> = {
          "0x...": "Uniswap V3",
          // Add more known contracts
        };
        
        if (isContract && !knownContracts[tx.to.toLowerCase()]) {
          riskFactors.push("⚠️ Interaction with unverified contract");
        }
      }

      // 4. Check for unusual patterns
    //   if (tx.nonce > 0) {
    //     // Get previous transactions
    //     const allTxs = await this.apiKit.getAllTransactions(args.safeAddress);
    //     const previousTx = allTxs.results.find(t => t.nonce === tx.nonce - 1);
        
    //     // Check for rapid sequence of transactions
    //     if (previousTx && 
    //         new Date(tx.submissionDate).getTime() - new Date(previousTx.submissionDate).getTime() < 300000) {
    //       riskFactors.push("⚠️ Quick sequence of transactions (< 5 min apart)");
    //     }
    //   }

      // 5. Check for complex contract interactions
      if (tx.dataDecoded?.parameters) {
        const paramCount = tx.dataDecoded.parameters.length;
        if (paramCount > 3) {
          riskFactors.push(`ℹ️ Complex transaction with ${paramCount} parameters`);
        }
      }

      // Add Etherscan contract verification check
      const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
      if (tx.to && ETHERSCAN_API_KEY) {
        try {
          const baseUrl = this.networkConfig.chain === "ethereum-sepolia" 
            ? "https://api-sepolia.etherscan.io/api"
            : this.networkConfig.chain === "base-sepolia"
            ? "https://api-sepolia.basescan.org/api"
            : "https://api.basescan.org/api";

          const response = await fetch(
            `${baseUrl}?module=contract&action=getsourcecode&address=${tx.to}&apikey=${ETHERSCAN_API_KEY}`
          );
          const data = await response.json();
          
          if (data.status === "1" && data.result[0]) {
            if (!data.result[0].ContractName) {
              riskFactors.push("⚠️ Contract not verified on Etherscan/Basescan");
            } else {
              actionDescription += `\nContract Name: ${data.result[0].ContractName}`;
              if (data.result[0].Implementation) { // Check if proxy
                actionDescription += `\nImplementation: ${data.result[0].Implementation}`;
              }
            }
          }
        } catch (error) {
          console.error("Etherscan API error:", error);
        }
      }

      // Add Tenderly simulation
      try {
        const networkId = this.networkConfig.chain === "ethereum-sepolia" 
          ? "11155111" 
          : this.networkConfig.chain === "base-sepolia"
          ? "84532"
          : "8453";

        const simulationResult = await simulateWithTenderly(tx, networkId);
        
        if (!simulationResult.success) {
          riskFactors.push(`⚠️ Transaction simulation failed: ${simulationResult.error || "Unknown error"}`);
        } else {
          const gasUsed = simulationResult.gasUsed 
            ? `\nEstimated gas usage: ${simulationResult.gasUsed}`
            : '';
          actionDescription += `\nTransaction simulation successful.${gasUsed}`;
        }
      } catch (error) {
        console.error("Tenderly simulation error:", error);
      }

      // Get historical context
      const allTxs = await this.apiKit.getAllTransactions(args.safeAddress);
      console.log("allTxs: ", allTxs);

    //   const similarTxs = allTxs.results.filter(pastTx => 
    //     (pastTx.safeTxHash !== tx.safeTxHash) && // Don't include current tx
    //     (pastTx.to === tx.to || 
    //      (pastTx.dataDecoded?.method === tx.dataDecoded?.method) ||
    //      (pastTx.value === tx.value && tx.value !== "0"))
    //   );

    //   // Add historical analysis to risk factors
    //   if (similarTxs.length > 0) {
    //     const recentSimilarTxs = similarTxs.slice(0, 3);
    //     actionDescription += "\n\nSimilar Past Transactions:";
    //     recentSimilarTxs.forEach(pastTx => {
    //       const pastTxDate = new Date(pastTx.submissionDate).toLocaleDateString();
    //       actionDescription += `\n- ${pastTx.safeTxHash} (${pastTxDate})`;
    //       if (pastTx.isExecuted) {
    //         actionDescription += " ✓ Executed successfully";
    //       } else if (pastTx.isSuccessful === false) {
    //         riskFactors.push("⚠️ Similar transaction has failed in the past");
    //       }
    //     });
    //   } else if (tx.value !== "0" || tx.dataDecoded) {
    //     // If this is a non-trivial transaction with no history
    //     riskFactors.push("ℹ️ No similar transactions found in Safe history");
    //   }

      // Update destination analysis with known addresses
      if (tx.to) {
        const toName = getAddressName(tx.to);
        if (toName !== tx.to) {
          actionDescription = actionDescription.replace(tx.to, `${toName} (${tx.to})`);
        } else if (!knownAddresses.has(tx.to.toLowerCase())) {
          riskFactors.push("⚠️ Destination address not in Safe's address book");
        }
      }

      // Build analysis report
      return `Transaction Analysis for ${args.safeTxHash}:

OVERVIEW
- Proposed by: ${proposerName} (${tx.proposer})
- Proposed at: ${proposedAt}
- Status: ${tx.isExecuted ? 'Executed' : 'Pending'} (${confirmationStatus})
- Confirmed by: ${confirmedBy}

ACTION
${actionDescription}

DETAILS
- To: ${getAddressName(tx.to)} (${tx.to})
- Value: ${parseFloat(tx.value) / 1e18} ETH
- Nonce: ${tx.nonce}
${tx.dataDecoded ? `- Method: ${tx.dataDecoded.method}` : ''}

RISK ANALYSIS
${riskFactors.length > 0 
  ? riskFactors.join('\n')
  : '✅ No significant risk factors identified'}

CONFIRMATIONS NEEDED
${confirmations < tx.confirmationsRequired 
  ? `Needs ${tx.confirmationsRequired - confirmations} more confirmation(s) before it can be executed`
  : 'Has enough confirmations and can be executed'}`;

    } catch (error) {
      return `Error analyzing transaction: ${error instanceof Error ? error.message : String(error)}`;
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
