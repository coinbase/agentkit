import { z } from "zod";
import { CreateAction } from "../actionDecorator";
import { ActionProvider } from "../actionProvider";
import { EvmWalletProvider } from "../../wallet-providers";
import { SafeInfoSchema, GetAllowanceInfoSchema, WithdrawAllowanceSchema } from "./schemas";
import { Network, NETWORK_ID_TO_VIEM_CHAIN } from "../../network";
import {
  Chain,
  formatEther,
  formatUnits,
  Hex,
  encodeFunctionData,
  zeroAddress,
  parseUnits,
} from "viem";

import { abi as ERC20_ABI } from "../erc20/constants";

import SafeApiKit from "@safe-global/api-kit";
import { getAllowanceModuleDeployment } from "@safe-global/safe-modules-deployments";

/**
 * Configuration options for the SafeActionProvider.
 */
export interface SafeApiActionProviderConfig {
  /**
   * The network ID to use for the SafeActionProvider.
   */
  networkId?: string;
}

/**
 * SafeApiActionProvider is an action provider for Safe.
 *
 * This provider is used for any action that uses the Safe API, but does not require a connected Safe Wallet.
 */
export class SafeApiActionProvider extends ActionProvider<EvmWalletProvider> {
  #chain: Chain;
  #apiKit: SafeApiKit;

  /**
   * Constructor for the SafeActionProvider class.
   *
   * @param config - The configuration options for the SafeActionProvider.
   */
  constructor(config: SafeApiActionProviderConfig = {}) {
    super("safe", []);

    // Initialize chain
    this.#chain = NETWORK_ID_TO_VIEM_CHAIN[config.networkId || "base-sepolia"];
    if (!this.#chain) throw new Error(`Unsupported network: ${config.networkId}`);

    // Initialize apiKit with chain ID from Viem chain
    this.#apiKit = new SafeApiKit({
      chainId: BigInt(this.#chain.id),
    });
  }

  /**
   * Connects to an existing Safe smart account.
   *
   * @param walletProvider - The wallet provider to use for the action.
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
      // Get Safe info
      const safeInfo = await this.#apiKit.getSafeInfo(args.safeAddress);

      const owners = safeInfo.owners;
      const threshold = safeInfo.threshold;
      const modules = safeInfo.modules;
      const nonce = safeInfo.nonce;

      // Get balance
      const ethBalance = formatEther(
        await walletProvider.getPublicClient().getBalance({ address: args.safeAddress }),
      );

      // Get pending transactions
      const pendingTransactions = await this.#apiKit.getPendingTransactions(args.safeAddress);
      const pendingTxDetails = pendingTransactions.results
        .filter(tx => !tx.isExecuted)
        .map(tx => {
          const confirmations = tx.confirmations?.length || 0;
          const needed = tx.confirmationsRequired;
          const confirmedBy = tx.confirmations?.map(c => c.owner).join(", ") || "none";
          return `\n- Transaction ${tx.safeTxHash} (${confirmations}/${needed} confirmations, confirmed by: ${confirmedBy})`;
        })
        .join("");

      return `Safe info:
- Safe at address: ${args.safeAddress}
- Chain: ${this.#chain.name}
- ${owners.length} owners: ${owners.join(", ")}
- Threshold: ${threshold}
- Nonce: ${nonce}
- Modules: ${modules.join(", ")}
- Balance: ${ethBalance} ETH
- Pending transactions: ${pendingTransactions.count}${pendingTxDetails}`;
    } catch (error) {
      return `Safe info: Error connecting to Safe: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Gets the current allowance for a delegate to spend tokens from the Safe.
   *
   * @param walletProvider - The wallet provider to connect to the Safe.
   * @param args - The Safe address and delegate address.
   * @returns A message containing the current allowance details.
   */
  @CreateAction({
    name: "get_allowance_info",
    description: `
Gets the current token spending allowance for a delegate address.
Takes the following inputs:
- safeAddress: Address of the Safe
- delegateAddress: Address of the delegate to check allowance for

Important notes:
- Requires an existing Safe
- Allowance module must be enabled
- Returns all token allowances for the delegate
`,
    schema: GetAllowanceInfoSchema,
  })
  async getAllowanceInfo(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetAllowanceInfoSchema>,
  ): Promise<string> {
    try {
      // Get allowance module for current chain
      const chainId = this.#chain.id.toString();
      const allowanceModule = getAllowanceModuleDeployment({ network: chainId });
      if (!allowanceModule) {
        throw new Error(`Allowance module not found for chainId [${chainId}]`);
      }

      const moduleAddress = allowanceModule.networkAddresses[chainId];

      // Get all tokens for which the delegate has allowances
      const tokens = (await walletProvider.readContract({
        address: moduleAddress,
        abi: allowanceModule.abi,
        functionName: "getTokens",
        args: [args.safeAddress, args.delegateAddress],
      })) as Hex[];

      if (tokens.length === 0) {
        return `Get allowance: Delegate ${args.delegateAddress} has no token allowances from Safe ${args.safeAddress}`;
      }

      // Get allowance details for each token
      const allowanceDetails = await Promise.all(
        tokens.map(async tokenAddress => {
          // Get allowance
          const allowance = await walletProvider.readContract({
            address: moduleAddress,
            abi: allowanceModule.abi,
            functionName: "getTokenAllowance",
            args: [args.safeAddress, args.delegateAddress, tokenAddress],
          });

          // Get token details for better formatting
          let tokenSymbol = "Unknown";
          let tokenDecimals = 18;
          let safeBalance = BigInt(0);

          try {
            tokenSymbol = (await walletProvider.readContract({
              address: tokenAddress,
              abi: ERC20_ABI,
              functionName: "symbol",
            })) as string;

            tokenDecimals = (await walletProvider.readContract({
              address: tokenAddress,
              abi: ERC20_ABI,
              functionName: "decimals",
            })) as number;

            // Get Safe balance for this token
            safeBalance = (await walletProvider.readContract({
              address: tokenAddress,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [args.safeAddress],
            })) as bigint;
          } catch (error) {
            console.log(`Error getting token details for ${tokenAddress}:`, error);
          }

          // Format allowance with token decimals
          const amount = formatUnits(allowance[0], tokenDecimals);
          const spent = formatUnits(allowance[1], tokenDecimals);
          const remaining = parseFloat(amount) - parseFloat(spent);
          const formattedBalance = formatUnits(safeBalance, tokenDecimals);

          return {
            tokenAddress,
            tokenSymbol,
            amount,
            spent,
            remaining,
            balance: formattedBalance,
            resetTimeMin: allowance[2],
            lastResetMin: allowance[3],
            nonce: allowance[4],
          };
        }),
      );

      // Format the response
      const allowanceStrings = allowanceDetails
        .map(details => {
          let resetInfo = "";
          if (details.resetTimeMin > 0) {
            const lastResetTimestamp = Number(details.lastResetMin) * 60 * 1000; // Convert minutes to milliseconds
            const resetIntervalMs = Number(details.resetTimeMin) * 60 * 1000; // Convert minutes to milliseconds
            const nextResetTimestamp = lastResetTimestamp + resetIntervalMs;
            const now = Date.now();
            const minutesUntilNextReset = Math.max(
              0,
              Math.floor((nextResetTimestamp - now) / (60 * 1000)),
            );

            resetInfo = ` (resets every ${details.resetTimeMin} minutes, next reset in ${minutesUntilNextReset} minutes)`;
          }

          return `\n- ${details.tokenSymbol} (${details.tokenAddress}):
  • Current Safe balance: ${details.balance} ${details.tokenSymbol}
  • Allowance: ${details.remaining} available of ${details.amount} total (${details.spent} spent)${resetInfo}`;
        })
        .join("");

      return `Get allowance: Delegate ${args.delegateAddress} has the following allowances from Safe ${args.safeAddress}:${allowanceStrings}`;
    } catch (error) {
      return `Get allowance: Error getting allowance: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Withdraws tokens using an allowance from a Safe.
   *
   * @param walletProvider - The wallet provider to connect to the Safe.
   * @param args - The input arguments for withdrawing the allowance.
   * @returns A message containing the withdrawal details.
   */
  @CreateAction({
    name: "withdraw_allowance",
    description: `
Withdraws tokens using an allowance from a Safe.
Takes the following inputs:
- safeAddress: Address of the Safe
- delegateAddress: Address of the delegate to withdraw allowance for
- tokenAddress:  Address of the ERC20 token 
- amount: Amount of tokens to withdraw in whole units (e.g. 1.5 WETH, 10 USDC)
- recipientAddress: (Optional) Address to receive the tokens (defaults to delegate address)

Important notes:
- Requires an existing Safe
- Allowance module must be enabled
- Must have sufficient allowance
- Amount must be within allowance limit
- Safe must have sufficient token balance
`,
    schema: WithdrawAllowanceSchema,
  })
  async withdrawAllowance(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof WithdrawAllowanceSchema>,
  ): Promise<string> {
    try {
      // Get allowance module for current chain
      const chainId = this.#chain.id.toString();
      const allowanceModule = getAllowanceModuleDeployment({ network: chainId });
      if (!allowanceModule) {
        throw new Error(`Allowance module not found for chainId [${chainId}]`);
      }

      const moduleAddress = allowanceModule.networkAddresses[chainId];

      // Get current allowance to check nonce
      const allowance = await walletProvider.readContract({
        address: moduleAddress,
        abi: allowanceModule.abi,
        functionName: "getTokenAllowance",
        args: [args.safeAddress, args.delegateAddress, args.tokenAddress],
      });

      // Get token decimals and convert amount
      const tokenDecimals = await walletProvider.readContract({
        address: args.tokenAddress as Hex,
        abi: ERC20_ABI,
        functionName: "decimals",
      });

      // Get token details for better formatting
      const tokenSymbol = await walletProvider.readContract({
        address: args.tokenAddress as Hex,
        abi: ERC20_ABI,
        functionName: "symbol",
      });

      // Convert amount to token decimals
      const amount = parseUnits(args.amount, Number(tokenDecimals));

      // Check if Safe has sufficient token balance
      const safeBalance = (await walletProvider.readContract({
        address: args.tokenAddress as Hex,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [args.safeAddress],
      })) as bigint;

      if (safeBalance < amount) {
        throw new Error(
          `Insufficient token balance. Safe has ${formatUnits(safeBalance, Number(tokenDecimals))} ${tokenSymbol}, but ${args.amount} ${tokenSymbol} was requested.`,
        );
      }

      // Generate transfer hash
      const hash = await walletProvider.readContract({
        address: moduleAddress,
        abi: allowanceModule.abi,
        functionName: "generateTransferHash",
        args: [
          args.safeAddress,
          args.tokenAddress,
          args.delegateAddress,
          amount,
          zeroAddress,
          0,
          allowance[4], // nonce
        ],
      });

      // Sign the hash
      const signature = await walletProvider.signHash(hash as unknown as Hex);

      // Send transaction
      const tx = await walletProvider.sendTransaction({
        to: moduleAddress,
        data: encodeFunctionData({
          abi: allowanceModule.abi,
          functionName: "executeAllowanceTransfer",
          args: [
            args.safeAddress,
            args.tokenAddress,
            args.delegateAddress,
            amount,
            zeroAddress,
            0,
            args.delegateAddress,
            signature,
          ],
        }),
        value: BigInt(0),
      });

      const receipt = await walletProvider.waitForTransactionReceipt(tx as Hex);

      return `Withdraw allowance: Successfully withdrew ${args.amount} ${tokenSymbol} from Safe ${args.safeAddress} to ${args.delegateAddress}. Transaction hash: ${receipt.transactionHash}`;
    } catch (error) {
      return `Withdraw allowance: Error withdrawing allowance: ${error instanceof Error ? error.message : String(error)}`;
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

export const safeApiActionProvider = (config: SafeApiActionProviderConfig = {}) =>
  new SafeApiActionProvider(config);
