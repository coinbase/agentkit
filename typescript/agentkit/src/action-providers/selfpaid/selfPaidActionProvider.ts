import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import { DEFAULT_SELFPAID_API_URL, SUPPORTED_NETWORKS } from "./constants";
import {
  CheckYieldRatesSchema,
  QuoteZeroCostPaymentSchema,
  PrepareZeroCostPaymentSchema,
  SendZeroCostPaymentSchema,
  GetTreasuryStatusSchema,
  RedeemCollateralSchema,
  SelfPaidConfig,
} from "./schemas";

/**
 * SelfPaidActionProvider enables AI agents to execute zero-net-cost USDC payments,
 * bounties, and tips on Base Mainnet with 100% principal recovery via automated
 * DeFi yield farming on Aave V3 and Morpho.
 */
export class SelfPaidActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly apiUrl: string;

  /**
   * Creates a new SelfPaidActionProvider instance.
   *
   * @param config - Optional API endpoint override
   */
  constructor(config: SelfPaidConfig = {}) {
    super("selfpaid", []);
    this.apiUrl =
      config.apiUrl ?? process.env.SELFPAY_API_URL ?? DEFAULT_SELFPAID_API_URL;
  }

  /**
   * Helper method to perform JSON HTTP requests against the SelfPaidPal API.
   *
   * @param path - Relative API path
   * @param options - Optional method and JSON body
   * @returns Parsed JSON response
   */
  private async apiRequest<T = Record<string, any>>(
    path: string,
    options: { method?: string; body?: Record<string, unknown> } = {},
  ): Promise<T> {
    const url = new URL(path, this.apiUrl);
    const response = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });

    const data = (await response.json().catch(() => null)) as Record<string, any> | null;
    if (!response.ok || !data) {
      throw new Error(
        (data?.error as string | undefined) ?? `SelfPaid API HTTP ${response.status}`,
      );
    }
    return data as T;
  }

  /**
   * 1. Check live DeFi yield rates on Base (Aave V3 & Morpho).
   *
   * @param _walletProvider - The EVM wallet provider
   * @param _args - Empty input object
   * @returns Formatted summary of live USDC APYs and 100% recovery durations
   */
  @CreateAction({
    name: "check_yield_rates",
    description:
      "Fetch current live USDC lending APYs on Base Mainnet for Aave V3 and Morpho Vaults. Helps the agent calculate recovery duration before transacting.",
    schema: CheckYieldRatesSchema,
  })
  async checkYieldRates(
    _walletProvider: EvmWalletProvider,
    _args: z.infer<typeof CheckYieldRatesSchema>,
  ): Promise<string> {
    try {
      const data = await this.apiRequest("/api/v1/payment/rates");
      const aaveAPY = ((data.rates?.aave?.supplyAPY ?? 0) * 100).toFixed(2);
      const morphoAPY = ((data.rates?.morpho?.netApy ?? 0) * 100).toFixed(2);
      const best = String(data.bestProtocol ?? "aave").toUpperCase();

      return (
        `📈 **Live DeFi Yield Rates on Base Mainnet**:\n` +
        `• **Aave V3 USDC**: **${aaveAPY}% APY**\n` +
        `• **Morpho USDC Vault**: **${morphoAPY}% APY**\n` +
        `• **Recommended Protocol**: **${best}** (Highest yield efficiency)\n\n` +
        `⚡ **Estimated 100% Capital Recovery Speeds**:\n` +
        `• 3x Collateral: ~${data.recoveryEstimateDays?.["3x"] ?? 230} days\n` +
        `• 5x Collateral: ~${data.recoveryEstimateDays?.["5x"] ?? 138} days\n` +
        `• 10x Collateral: ~${data.recoveryEstimateDays?.["10x"] ?? 69} days\n\n` +
        `🛡️ *Yield tokens (aBasUSDC/maUSDC) remain in your wallet with Zero Lockup: withdraw anytime.*`
      );
    } catch (error) {
      return `❌ Failed to fetch live yield rates: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * 2. Quote a zero-cost payment (collateral, fees, and recovery ETA).
   *
   * @param _walletProvider - The EVM wallet provider
   * @param args - Payment quote parameters
   * @returns Formatted payment quote and recovery duration
   */
  @CreateAction({
    name: "quote_zero_cost_payment",
    description:
      "Calculate the required yield deposit, developer fee (0.5%, min 0.1 USDC), and estimated recovery duration for a zero-net-cost payment on Base.",
    schema: QuoteZeroCostPaymentSchema,
  })
  async quoteZeroCostPayment(
    _walletProvider: EvmWalletProvider,
    args: z.infer<typeof QuoteZeroCostPaymentSchema>,
  ): Promise<string> {
    try {
      const params = new URLSearchParams({
        amount: String(args.amount),
        protocol: args.protocol ?? "auto",
        collateral: String(args.collateralMultiplier ?? 3),
        buffer: String(args.bufferPercentage ?? 3),
      });
      const quote = await this.apiRequest(`/api/v1/payment/quote?${params.toString()}`);

      return (
        `💰 **SelfPaid Zero-Cost Payment Quote**:\n` +
        `• **Recipient Payout**: **${quote.amountToPay} USDC**\n` +
        `• **Maintenance Fee (0.5%)**: **${quote.feeAmount} USDC** (to protocol dev wallet)\n` +
        `• **Yield Collateral**: **${quote.yieldDepositAmount} USDC** (deposited into **${String(quote.selectedProtocol).toUpperCase()}**)\n` +
        `• **Total Required Upfront**: **${quote.totalRequiredAmount} USDC**\n` +
        `• **Effective APY**: ${((quote.estimatedAPY ?? 0) * 100).toFixed(2)}%\n` +
        `• **Reimbursement ETA**: **100% of payout recouped in ~${quote.estimatedRecoveryDays} days**\n\n` +
        `🛡️ **Zero Lockup Guarantee**: Collateral tokens are minted directly to your address and can be redeemed with 1 single transaction anytime.`
      );
    } catch (error) {
      return `❌ Failed to generate zero-cost payment quote: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * 3. Prepare zero-cost payment batch without broadcasting (simulation & Safe Multisig export).
   *
   * @param walletProvider - The EVM wallet provider
   * @param args - Payment preparation parameters
   * @returns Prepared transaction batch and Safe Transaction Builder JSON
   */
  @CreateAction({
    name: "prepare_zero_cost_payment",
    description:
      "Prepare a 4-call atomic zero-cost payment batch on Base without executing. Returns transaction calldata, breakdown, and Safe Transaction Builder JSON for DAOs.",
    schema: PrepareZeroCostPaymentSchema,
  })
  async prepareZeroCostPayment(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PrepareZeroCostPaymentSchema>,
  ): Promise<string> {
    try {
      let sender = "0x0000000000000000000000000000000000000000";
      try {
        sender = walletProvider.getAddress();
      } catch {
        // Fallback for simulation mode
      }

      const payment = await this.apiRequest("/api/v1/payment/build", {
        method: "POST",
        body: {
          amount: args.amount,
          recipient: args.recipient,
          sender,
          protocol: args.protocol ?? "auto",
          collateral: args.collateralMultiplier ?? 3,
          buffer: args.bufferPercentage ?? 3,
        },
      });

      const safeBatch = {
        version: "1.0",
        chainId: "8453",
        createdAt: Date.now(),
        meta: {
          name: `SelfPaid Zero-Cost Payment (${args.amount} USDC)`,
          description: `SelfPaidPal 4-call atomic batch on Base to ${args.recipient}`,
        },
        transactions: (payment.transactions ?? []).map((t: Record<string, any>) => ({
          to: t.to,
          value: t.value || "0",
          data: t.data,
          contractMethod: null,
          contractInputsValues: null,
        })),
      };

      return (
        `📋 **Prepared Zero-Cost Payment Batch (Base Chain ID 8453)**:\n` +
        `• **Recipient**: \`${args.recipient}\` receives **${args.amount} USDC**\n` +
        `• **Sender**: \`${sender}\`\n` +
        `• **Developer Fee**: ${payment.summary.feeAmount} USDC\n` +
        `• **Yield Collateral**: ${payment.summary.yieldDepositAmount} USDC to ${String(payment.summary.protocol).toUpperCase()}\n` +
        `• **Total Capital**: ${payment.summary.totalRequiredAmount} USDC (100% recouped in ~${payment.summary.estimatedRecoveryDays} days)\n\n` +
        `**Sequential EVM Transactions (4 calls)**:\n` +
        (payment.transactions ?? [])
          .map((t: Record<string, any>) => `  ${t.step}. **${t.name}**: \`${t.to}\` — *${t.description}*`)
          .join("\n") +
        `\n\n**Safe Multisig JSON Payload**:\n\`\`\`json\n${JSON.stringify(safeBatch, null, 2)}\n\`\`\``
      );
    } catch (error) {
      return `❌ Failed to prepare zero-cost payment: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * 4. Send zero-cost payment on-chain (Autonomous Agent Execution).
   *
   * @param walletProvider - The EVM wallet provider
   * @param args - Payment execution parameters
   * @returns On-chain transaction hashes and recovery details
   */
  @CreateAction({
    name: "send_zero_cost_payment",
    description:
      "Execute a zero-net-cost USDC payment directly on Base Mainnet. Automatically pays the recipient, developer fee, and deposits yield collateral into Aave/Morpho so the agent recovers 100% of the funds.",
    schema: SendZeroCostPaymentSchema,
  })
  async sendZeroCostPayment(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SendZeroCostPaymentSchema>,
  ): Promise<string> {
    try {
      const sender = walletProvider.getAddress();
      const network = walletProvider.getNetwork();

      if (network.chainId && network.chainId !== "8453" && Number(network.chainId) !== 8453) {
        return `⚠️ SelfPaidPal requires Base Mainnet (Chain ID 8453). Active network: ${network.networkId || network.chainId}`;
      }

      const payment = await this.apiRequest("/api/v1/payment/build", {
        method: "POST",
        body: {
          amount: args.amount,
          recipient: args.recipient,
          sender,
          protocol: args.protocol ?? "auto",
          collateral: args.collateralMultiplier ?? 3,
          buffer: args.bufferPercentage ?? 3,
        },
      });

      let txsToExecute: Array<Record<string, any>> = [...(payment.transactions ?? [])];
      const approveTx = txsToExecute.find(t => t.name === "APPROVE_POOL");
      const supplyTx = txsToExecute.find(t => t.name === "SUPPLY_YIELD");

      if (approveTx && supplyTx) {
        try {
          const currentAllowance = await walletProvider.readContract({
            address: approveTx.to as `0x${string}`,
            abi: [
              {
                name: "allowance",
                type: "function",
                stateMutability: "view",
                inputs: [
                  { name: "owner", type: "address" },
                  { name: "spender", type: "address" },
                ],
                outputs: [{ name: "", type: "uint256" }],
              },
            ],
            functionName: "allowance",
            args: [sender as `0x${string}`, supplyTx.to as `0x${string}`],
          });

          const requiredHex =
            approveTx.data && approveTx.data.length >= 138
              ? approveTx.data.slice(74, 138)
              : supplyTx.data.slice(74, 138);
          const requiredWei = BigInt("0x" + requiredHex);
          if (BigInt((currentAllowance as bigint | number | string) || 0) >= requiredWei) {
            txsToExecute = txsToExecute.filter(t => t.name !== "APPROVE_POOL");
          } else {
            const maxUint256Hex = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
            const spenderHex = String(supplyTx.to).slice(2).toLowerCase().padStart(64, "0");
            approveTx.data = "0x095ea7b3" + spenderHex + maxUint256Hex;
          }
        } catch {
          // Proceed with standard sequence if readContract fails
        }
      }

      const executedHashes: Array<{ step: number; name: string; hash: string }> = [];

      for (const tx of txsToExecute) {
        const hash = await walletProvider.sendTransaction({
          to: tx.to as `0x${string}`,
          data: tx.data as `0x${string}`,
          value: BigInt(tx.value || 0),
        });

        const receipt = await walletProvider.waitForTransactionReceipt(hash);
        if (receipt && (receipt.status === "reverted" || receipt.status === 0)) {
          throw new Error(`Transaction ${tx.name} reverted on-chain. Hash: ${hash}`);
        }

        executedHashes.push({
          step: tx.step,
          name: tx.name,
          hash,
        });
      }

      const payTx = executedHashes.find(t => t.name === "PAYMENT")?.hash;
      const supplyTxHash = executedHashes.find(t => t.name === "SUPPLY_YIELD")?.hash;
      const feeTxHash = executedHashes.find(t => t.name === "DEVELOPER_FEE")?.hash;

      return (
        `🚀 **Zero-Cost Payment Successfully Executed on Base!**\n\n` +
        `• **Recipient**: \`${args.recipient}\` received **${args.amount} USDC**\n` +
        `• **Maintenance Fee**: ${payment.summary.feeAmount} USDC\n` +
        `• **Yield Collateral**: ${payment.summary.yieldDepositAmount} USDC supplied to **${String(payment.summary.protocol).toUpperCase()}**\n` +
        `• **Principal Recovery**: **100% recouped in ~${payment.summary.estimatedRecoveryDays} days**\n\n` +
        `🔍 **BaseScan Verified Transactions**:\n` +
        `• Payment Tx: https://basescan.org/tx/${payTx}\n` +
        (feeTxHash ? `• Fee Tx: https://basescan.org/tx/${feeTxHash}\n` : "") +
        (supplyTxHash ? `• Yield Deposit Tx: https://basescan.org/tx/${supplyTxHash}\n` : "") +
        `\n🛡️ *Yield tokens have been minted directly to your agent wallet (${sender}). Zero Lockup: withdraw anytime.*`
      );
    } catch (error) {
      return `❌ On-chain execution failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * 5. Get accumulated treasury and yield recovery progress.
   *
   * @param walletProvider - The EVM wallet provider
   * @param args - Optional wallet address override
   * @returns Formatted treasury balances and yield status
   */
  @CreateAction({
    name: "get_treasury_status",
    description:
      "Check active yield-bearing collateral (aBasUSDC/maUSDC), accrued yield interest, and capital recovery percentage for an agent address on Base.",
    schema: GetTreasuryStatusSchema,
  })
  async getTreasuryStatus(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetTreasuryStatusSchema>,
  ): Promise<string> {
    try {
      const wallet = args.walletAddress || walletProvider.getAddress();
      const treasury = await this.apiRequest(
        `/api/v1/payment/treasury?wallet=${encodeURIComponent(wallet)}`,
      );

      return (
        `🏛️ **SelfPaid Treasury & Yield Status on Base**:\n` +
        `• **Wallet**: \`${wallet}\`\n` +
        `• **Liquid USDC**: ${treasury.balances?.liquidUsdc || "0.00"} USDC\n` +
        `• **Aave V3 Collateral (aBasUSDC)**: ${treasury.balances?.aaveYieldUsdc || "0.00"} USDC\n` +
        `• **Morpho Collateral (maUSDC)**: ${treasury.balances?.morphoYieldUsdc || "0.00"} USDC\n` +
        `• **Total Capital Earning Yield**: **${treasury.balances?.totalYieldUsdc || "0.00"} USDC**\n` +
        `• **Total Accrued Yield**: +${treasury.balances?.totalAccruedYieldUsdc || "0.00"} USDC\n\n` +
        `🛡️ *All collateral is 100% liquid with Zero Lockup: redeem anytime using redeem_collateral.*`
      );
    } catch (error) {
      return `❌ Failed to fetch treasury status: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * 6. Redeem/Withdraw yield collateral back to liquid USDC.
   *
   * @param walletProvider - The EVM wallet provider
   * @param args - Redeem protocol, amount, and execution flag
   * @returns Withdrawal calldata or executed transaction receipt
   */
  @CreateAction({
    name: "redeem_collateral",
    description:
      "Withdraw/redeem yield-bearing collateral (aBasUSDC or maUSDC) back to liquid USDC with zero lockup penalty.",
    schema: RedeemCollateralSchema,
  })
  async redeemCollateral(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof RedeemCollateralSchema>,
  ): Promise<string> {
    try {
      const wallet = walletProvider.getAddress();
      const withdrawal = await this.apiRequest("/api/v1/payment/withdraw", {
        method: "POST",
        body: {
          protocol: args.protocol,
          amount: args.amount !== undefined ? args.amount : "all",
          walletAddress: wallet,
        },
      });

      if (args.execute) {
        const hash = await walletProvider.sendTransaction({
          to: withdrawal.transaction.to as `0x${string}`,
          data: withdrawal.transaction.data as `0x${string}`,
          value: BigInt(withdrawal.transaction.value || 0),
        });

        const receipt = await walletProvider.waitForTransactionReceipt(hash);
        if (receipt && (receipt.status === "reverted" || receipt.status === 0)) {
          throw new Error(`Collateral withdrawal reverted on-chain. Hash: ${hash}`);
        }

        return (
          `✅ **Collateral Successfully Redeemed from ${args.protocol.toUpperCase()}!**\n\n` +
          `• **Amount Redeemed**: ${args.amount ? args.amount + " USDC" : "All available balance"}\n` +
          `• **Beneficiary**: \`${wallet}\`\n` +
          `• **Transaction Hash**: https://basescan.org/tx/${hash}\n\n` +
          `Liquid USDC is now available in your agent wallet.`
        );
      }

      return (
        `📋 **Prepared Collateral Withdrawal (${args.protocol.toUpperCase()})**:\n` +
        `• **Protocol**: ${args.protocol.toUpperCase()}\n` +
        `• **Amount**: ${args.amount ? args.amount + " USDC" : "All available collateral"}\n` +
        `• **Beneficiary**: \`${wallet}\`\n` +
        `• **Target Contract**: \`${withdrawal.transaction.to}\`\n` +
        `• **Calldata**: \`${withdrawal.transaction.data}\`\n\n` +
        `💡 *Set execute: true to automatically sign and broadcast this withdrawal on Base.*`
      );
    } catch (error) {
      return `❌ Failed to redeem collateral: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Checks if the action provider supports the given network.
   *
   * @param network - The network to check support for
   * @returns True if the wallet is on Base Mainnet
   */
  supportsNetwork = (network: Network): boolean =>
    network.protocolFamily === "evm" &&
    (!network.networkId ||
      (SUPPORTED_NETWORKS as readonly string[]).includes(network.networkId) ||
      network.chainId === "8453");
}

/**
 * Factory function for SelfPaidActionProvider.
 *
 * @param config - Optional SelfPaid configuration
 * @returns A new SelfPaidActionProvider instance
 */
export const selfPaidActionProvider = (config?: SelfPaidConfig) =>
  new SelfPaidActionProvider(config);
