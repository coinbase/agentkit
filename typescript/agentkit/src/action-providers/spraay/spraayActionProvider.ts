import { z } from "zod";
import { encodeFunctionData, parseUnits, formatUnits } from "viem";
import { ActionProvider, CreateAction, EvmWalletProvider, Network } from "@coinbase/agentkit";
import {
  SprayEthSchema,
  SprayTokenSchema,
  SprayEthVariableSchema,
  SprayTokenVariableSchema,
} from "./schemas";
import {
  SPRAAY_CONTRACT_ADDRESS,
  SPRAAY_ABI,
  ERC20_ABI,
  SPRAAY_PROTOCOL_FEE_BPS,
  SPRAAY_MAX_RECIPIENTS,
} from "./constants";

/**
 * SpraayActionProvider enables AI agents to batch-send ETH or ERC-20 tokens
 * to multiple recipients in a single transaction via the Spraay protocol on Base.
 *
 * Key features:
 * - Batch ETH sends (equal or variable amounts)
 * - Batch ERC-20 token sends (equal or variable amounts)
 * - Up to 200 recipients per transaction
 * - ~80% gas savings vs individual transfers
 * - 0.3% protocol fee
 *
 * Contract: 0x1646452F98E36A3c9Cfc3eDD8868221E207B5eEC (Base Mainnet)
 * Website: https://spraay.app
 */
export class SpraayActionProvider extends ActionProvider<EvmWalletProvider> {
  constructor() {
    super("spraay", []);
  }

  /**
   * Spray equal amounts of ETH to multiple recipients in one transaction.
   *
   * @param walletProvider - The wallet provider to send the transaction.
   * @param args - The input arguments (recipients, amountPerRecipient).
   * @returns A string describing the result of the transaction.
   */
  @CreateAction({
    name: "spraay_eth",
    description: `
Send equal amounts of ETH to multiple recipients in a single transaction via the Spraay protocol.
This is ideal for team payments, airdrops, or distributing rewards.
Up to 200 recipients per transaction with ~80% gas savings vs individual transfers.
A 0.3% protocol fee is applied. The contract is deployed on Base mainnet.
    `.trim(),
    schema: SprayEthSchema,
  })
  async sprayEth(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SprayEthSchema>
  ): Promise<string> {
    const { recipients, amountPerRecipient } = args;

    try {
      // Parse amount per recipient in wei
      const amountWei = parseUnits(amountPerRecipient, 18);
      const amounts = recipients.map(() => amountWei);

      // Calculate total value including 0.3% protocol fee
      const subtotal = amountWei * BigInt(recipients.length);
      const fee = (subtotal * BigInt(SPRAAY_PROTOCOL_FEE_BPS)) / BigInt(10000);
      const totalValue = subtotal + fee;

      // Encode the contract call
      const data = encodeFunctionData({
        abi: SPRAAY_ABI,
        functionName: "sprayETH",
        args: [recipients as `0x${string}`[], amounts],
      });

      // Send the transaction
      const txHash = await walletProvider.sendTransaction({
        to: SPRAAY_CONTRACT_ADDRESS as `0x${string}`,
        data,
        value: totalValue,
      });

      // Wait for confirmation
      const receipt = await walletProvider.waitForTransactionReceipt(txHash);

      return [
        `Successfully sprayed ${amountPerRecipient} ETH to ${recipients.length} recipients via Spraay.`,
        `Total sent: ${formatUnits(subtotal, 18)} ETH`,
        `Protocol fee (0.3%): ${formatUnits(fee, 18)} ETH`,
        `Transaction hash: ${txHash}`,
        `Block: ${receipt.blockNumber}`,
        `View on BaseScan: https://basescan.org/tx/${txHash}`,
      ].join("\n");
    } catch (error) {
      return `Error spraying ETH via Spraay: ${error}`;
    }
  }

  /**
   * Spray equal amounts of an ERC-20 token to multiple recipients.
   *
   * @param walletProvider - The wallet provider to send the transaction.
   * @param args - The input arguments (tokenAddress, recipients, amountPerRecipient).
   * @returns A string describing the result of the transaction.
   */
  @CreateAction({
    name: "spraay_token",
    description: `
Send equal amounts of an ERC-20 token (like USDC, DAI, or any token) to multiple recipients in a single transaction via the Spraay protocol.
Requires token approval before first use. Up to 200 recipients per transaction.
A 0.3% protocol fee is applied. The contract is deployed on Base mainnet.
    `.trim(),
    schema: SprayTokenSchema,
  })
  async sprayToken(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SprayTokenSchema>
  ): Promise<string> {
    const { tokenAddress, recipients, amountPerRecipient } = args;

    try {
      // Get token decimals and symbol
      const decimals = await this.getTokenDecimals(walletProvider, tokenAddress);
      const symbol = await this.getTokenSymbol(walletProvider, tokenAddress);

      // Parse amount per recipient
      const amountPerRecipientWei = parseUnits(amountPerRecipient, decimals);
      const amounts = recipients.map(() => amountPerRecipientWei);

      // Calculate total amount needed (including 0.3% fee)
      const subtotal = amountPerRecipientWei * BigInt(recipients.length);
      const fee = (subtotal * BigInt(SPRAAY_PROTOCOL_FEE_BPS)) / BigInt(10000);
      const totalAmount = subtotal + fee;

      // Check and set approval if needed
      const approvalResult = await this.ensureTokenApproval(
        walletProvider,
        tokenAddress,
        totalAmount
      );

      // Encode the contract call
      const data = encodeFunctionData({
        abi: SPRAAY_ABI,
        functionName: "sprayToken",
        args: [tokenAddress as `0x${string}`, recipients as `0x${string}`[], amounts],
      });

      // Send the transaction
      const txHash = await walletProvider.sendTransaction({
        to: SPRAAY_CONTRACT_ADDRESS as `0x${string}`,
        data,
      });

      // Wait for confirmation
      const receipt = await walletProvider.waitForTransactionReceipt(txHash);

      const resultLines = [];
      if (approvalResult) {
        resultLines.push(approvalResult);
      }
      resultLines.push(
        `Successfully sprayed ${amountPerRecipient} ${symbol} to ${recipients.length} recipients via Spraay.`,
        `Total sent: ${formatUnits(subtotal, decimals)} ${symbol}`,
        `Protocol fee (0.3%): ${formatUnits(fee, decimals)} ${symbol}`,
        `Transaction hash: ${txHash}`,
        `Block: ${receipt.blockNumber}`,
        `View on BaseScan: https://basescan.org/tx/${txHash}`
      );

      return resultLines.join("\n");
    } catch (error) {
      return `Error spraying tokens via Spraay: ${error}`;
    }
  }

  /**
   * Spray variable amounts of ETH to multiple recipients.
   *
   * @param walletProvider - The wallet provider to send the transaction.
   * @param args - The input arguments (recipients, amounts).
   * @returns A string describing the result of the transaction.
   */
  @CreateAction({
    name: "spraay_eth_variable",
    description: `
Send different amounts of ETH to multiple recipients in a single transaction via the Spraay protocol.
Each recipient gets a different specified amount. Ideal for bounty payouts or tiered distributions.
Up to 200 recipients per transaction. A 0.3% protocol fee is applied. Deployed on Base mainnet.
    `.trim(),
    schema: SprayEthVariableSchema,
  })
  async sprayEthVariable(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SprayEthVariableSchema>
  ): Promise<string> {
    const { recipients, amounts: amountStrings } = args;

    if (recipients.length !== amountStrings.length) {
      return `Error: recipients array length (${recipients.length}) must match amounts array length (${amountStrings.length}).`;
    }

    try {
      const amounts = amountStrings.map((a) => parseUnits(a, 18));
      const subtotal = amounts.reduce((sum, a) => sum + a, BigInt(0));
      const fee = (subtotal * BigInt(SPRAAY_PROTOCOL_FEE_BPS)) / BigInt(10000);
      const totalValue = subtotal + fee;

      const data = encodeFunctionData({
        abi: SPRAAY_ABI,
        functionName: "sprayETH",
        args: [recipients as `0x${string}`[], amounts],
      });

      const txHash = await walletProvider.sendTransaction({
        to: SPRAAY_CONTRACT_ADDRESS as `0x${string}`,
        data,
        value: totalValue,
      });

      const receipt = await walletProvider.waitForTransactionReceipt(txHash);

      return [
        `Successfully sprayed variable ETH amounts to ${recipients.length} recipients via Spraay.`,
        `Total sent: ${formatUnits(subtotal, 18)} ETH`,
        `Protocol fee (0.3%): ${formatUnits(fee, 18)} ETH`,
        `Transaction hash: ${txHash}`,
        `Block: ${receipt.blockNumber}`,
        `View on BaseScan: https://basescan.org/tx/${txHash}`,
      ].join("\n");
    } catch (error) {
      return `Error spraying variable ETH via Spraay: ${error}`;
    }
  }

  /**
   * Spray variable amounts of an ERC-20 token to multiple recipients.
   *
   * @param walletProvider - The wallet provider to send the transaction.
   * @param args - The input arguments (tokenAddress, recipients, amounts).
   * @returns A string describing the result of the transaction.
   */
  @CreateAction({
    name: "spraay_token_variable",
    description: `
Send different amounts of an ERC-20 token to multiple recipients in a single transaction via the Spraay protocol.
Each recipient gets a different specified amount. Requires token approval before first use.
Up to 200 recipients per transaction. A 0.3% protocol fee is applied. Deployed on Base mainnet.
    `.trim(),
    schema: SprayTokenVariableSchema,
  })
  async sprayTokenVariable(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SprayTokenVariableSchema>
  ): Promise<string> {
    const { tokenAddress, recipients, amounts: amountStrings } = args;

    if (recipients.length !== amountStrings.length) {
      return `Error: recipients array length (${recipients.length}) must match amounts array length (${amountStrings.length}).`;
    }

    try {
      const decimals = await this.getTokenDecimals(walletProvider, tokenAddress);
      const symbol = await this.getTokenSymbol(walletProvider, tokenAddress);

      const amounts = amountStrings.map((a) => parseUnits(a, decimals));
      const subtotal = amounts.reduce((sum, a) => sum + a, BigInt(0));
      const fee = (subtotal * BigInt(SPRAAY_PROTOCOL_FEE_BPS)) / BigInt(10000);
      const totalAmount = subtotal + fee;

      const approvalResult = await this.ensureTokenApproval(
        walletProvider,
        tokenAddress,
        totalAmount
      );

      const data = encodeFunctionData({
        abi: SPRAAY_ABI,
        functionName: "sprayToken",
        args: [tokenAddress as `0x${string}`, recipients as `0x${string}`[], amounts],
      });

      const txHash = await walletProvider.sendTransaction({
        to: SPRAAY_CONTRACT_ADDRESS as `0x${string}`,
        data,
      });

      const receipt = await walletProvider.waitForTransactionReceipt(txHash);

      const resultLines = [];
      if (approvalResult) {
        resultLines.push(approvalResult);
      }
      resultLines.push(
        `Successfully sprayed variable ${symbol} amounts to ${recipients.length} recipients via Spraay.`,
        `Total sent: ${formatUnits(subtotal, decimals)} ${symbol}`,
        `Protocol fee (0.3%): ${formatUnits(fee, decimals)} ${symbol}`,
        `Transaction hash: ${txHash}`,
        `Block: ${receipt.blockNumber}`,
        `View on BaseScan: https://basescan.org/tx/${txHash}`
      );

      return resultLines.join("\n");
    } catch (error) {
      return `Error spraying variable tokens via Spraay: ${error}`;
    }
  }

  /**
   * Check if the Spraay contract has sufficient token allowance, and approve if not.
   */
  private async ensureTokenApproval(
    walletProvider: EvmWalletProvider,
    tokenAddress: string,
    requiredAmount: bigint
  ): Promise<string | null> {
    const walletAddress = await walletProvider.getAddress();

    // Check current allowance
    const allowanceData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [walletAddress as `0x${string}`, SPRAAY_CONTRACT_ADDRESS as `0x${string}`],
    });

    const allowanceResult = await walletProvider.readContract(
      tokenAddress as `0x${string}`,
      ERC20_ABI,
      "allowance",
      [walletAddress, SPRAAY_CONTRACT_ADDRESS]
    );

    const currentAllowance = BigInt(allowanceResult as string);

    if (currentAllowance >= requiredAmount) {
      return null; // No approval needed
    }

    // Approve the Spraay contract to spend tokens
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [SPRAAY_CONTRACT_ADDRESS as `0x${string}`, requiredAmount],
    });

    const approveTxHash = await walletProvider.sendTransaction({
      to: tokenAddress as `0x${string}`,
      data: approveData,
    });

    await walletProvider.waitForTransactionReceipt(approveTxHash);

    return `Token approval granted to Spraay contract. Approval tx: ${approveTxHash}`;
  }

  /**
   * Get the number of decimals for an ERC-20 token.
   */
  private async getTokenDecimals(
    walletProvider: EvmWalletProvider,
    tokenAddress: string
  ): Promise<number> {
    try {
      const result = await walletProvider.readContract(
        tokenAddress as `0x${string}`,
        ERC20_ABI,
        "decimals",
        []
      );
      return Number(result);
    } catch {
      return 18; // Default to 18 decimals
    }
  }

  /**
   * Get the symbol for an ERC-20 token.
   */
  private async getTokenSymbol(
    walletProvider: EvmWalletProvider,
    tokenAddress: string
  ): Promise<string> {
    try {
      const result = await walletProvider.readContract(
        tokenAddress as `0x${string}`,
        ERC20_ABI,
        "symbol",
        []
      );
      return result as string;
    } catch {
      return "TOKEN";
    }
  }

  /**
   * Spraay is currently deployed only on Base mainnet.
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" && network.networkId === "base-mainnet";
}

/**
 * Factory function to create a new SpraayActionProvider instance.
 *
 * @returns A new SpraayActionProvider.
 *
 * @example
 * ```typescript
 * import { spraayActionProvider } from "./spraay";
 *
 * const agentKit = await AgentKit.from({
 *   walletProvider,
 *   actionProviders: [spraayActionProvider()],
 * });
 * ```
 */
export const spraayActionProvider = () => new SpraayActionProvider();
