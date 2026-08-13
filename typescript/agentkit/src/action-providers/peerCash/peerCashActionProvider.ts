/**
 * Peer Cash Action Provider
 *
 * This file contains the implementation of the PeerCashActionProvider, which
 * provides actions for cashing out Base USDC to fiat in the user's payment app
 * (Venmo, Revolut, Wise, Zelle, and more) via the Peer P2P protocol.
 *
 * @module peerCash
 */

import { z } from "zod";
import {
  createCashClient,
  isCashError,
  usdc,
  capabilitiesToJson,
  cashErrorToJson,
  estimateToJson,
  fillStatsToJson,
  orderToJson,
} from "@zkp2p/cash";
import type {
  CashClient,
  CashoutInput,
  CashPreparedStep,
  CashReceiveLeg,
  CurrencyType,
  PreparedCashoutReceipt,
  PreparedTransaction,
} from "@zkp2p/cash";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  CapabilitiesSchema,
  CashoutSchema,
  ConfigureAccessPolicySchema,
  EstimateSchema,
  ListOrdersSchema,
  OrderStatusSchema,
  TopUpSchema,
  WithdrawSchema,
} from "./schemas";

/**
 * Configuration options for the PeerCashActionProvider.
 */
export interface PeerCashActionProviderConfig {
  /**
   * Peer protocol environment. Defaults to "production". All environments
   * settle on Base mainnet; "preproduction" and "staging" select separate
   * escrow contracts and backend deployments for integration testing.
   */
  environment?: "production" | "preproduction" | "staging";

  /**
   * Six-character referral code from the Peer mobile or web app. When set,
   * deposits carry ERC-8021 attribution and the code owner earns the 50 bps
   * integration share each time an order fills.
   */
  referralCode?: string;

  /**
   * Analytics-only ERC-8021 attribution code(s), e.g. "acme-app". Carries no
   * revenue share; use referralCode for the integration share.
   */
  referrer?: string | string[];

  /**
   * Base RPC URL override. Defaults to the public Base RPC.
   */
  rpcUrl?: string;
}

/**
 * One submitted transaction of a prepared Peer Cash plan.
 */
interface SubmittedStep {
  kind: string;
  txHash: `0x${string}`;
  receipt: TransactionReceiptLike;
}

/**
 * The receipt fields this provider reads. EvmWalletProvider's
 * waitForTransactionReceipt is untyped and its shape varies by wallet
 * provider (viem transaction receipts vs CDP user operation receipts).
 */
interface TransactionReceiptLike {
  status?: unknown;
  transactionHash?: `0x${string}`;
  logs?: unknown;
}

/**
 * Thrown when a submitted transaction of a prepared plan reverted on-chain.
 */
class StepRevertedError extends Error {
  /**
   * Constructor for the StepRevertedError class.
   *
   * @param step - The step kind whose transaction reverted, e.g. "createDeposit".
   * @param txHash - The hash of the reverted transaction.
   */
  constructor(
    readonly step: string,
    readonly txHash: `0x${string}`,
  ) {
    super(`The ${step} transaction reverted (hash: ${txHash})`);
    this.name = "StepRevertedError";
  }
}

/**
 * Checks whether a wallet provider receipt reports an on-chain failure.
 * Viem receipts report "success" or "reverted"; CDP user operation receipts
 * report "complete" or "failed".
 *
 * @param receipt - The receipt returned by waitForTransactionReceipt.
 * @returns True when the receipt carries an explicit failure marker.
 */
function isRevertedReceipt(receipt: TransactionReceiptLike | null | undefined): boolean {
  const status = receipt?.status;
  return status === "reverted" || status === "failed" || status === 0 || status === "0x0";
}

/**
 * Formats an error from a Peer Cash operation into an actionable message.
 * CashErrors carry a stable code, whether the operation is retryable, a
 * remediation sentence, and optional recovery data; all of it is surfaced so
 * the agent can self-drive recovery instead of guessing.
 *
 * @param operation - Short description of the operation that failed.
 * @param error - The thrown error.
 * @returns A human-readable error message.
 */
function describeCashError(operation: string, error: unknown): string {
  if (isCashError(error)) {
    const parts = [
      `Error (${error.code}) while ${operation}: ${error.message}`,
      `Remediation: ${error.remediation}`,
      `Retryable: ${error.retryable ? "yes" : "no"}.`,
    ];
    if (error.recovery) {
      parts.push(`Recovery data: ${JSON.stringify(cashErrorToJson(error).recovery)}`);
    }
    return parts.join(" ");
  }
  return `Error while ${operation}: ${error}`;
}

/**
 * PeerCashActionProvider provides actions for cashing out Base USDC to fiat
 * via the Peer P2P protocol (peer.xyz).
 *
 * @description
 * The wallet is the maker: its USDC moves into the non-custodial Peer escrow
 * contract, a buyer pays fiat to the configured payment handle and proves the
 * payment, and the escrow releases the USDC. Orders fill at the live Chainlink
 * oracle market rate with zero spread; there are no locked quotes and no API
 * keys. Every order is resumable from its deposit id alone, and unfilled USDC
 * can be withdrawn at any time.
 */
export class PeerCashActionProvider extends ActionProvider<EvmWalletProvider> {
  readonly #client: CashClient;

  /**
   * Constructor for the PeerCashActionProvider class.
   *
   * @param config - Configuration options, including the Peer environment and
   * an optional referral code for the integration share.
   */
  constructor(config: PeerCashActionProviderConfig = {}) {
    super("peerCash", []);
    // createCashClient validates the referral code eagerly, so a bad code
    // fails at construction instead of on the first cash-out.
    this.#client = createCashClient({
      environment: config.environment ?? "production",
      referralCode: config.referralCode,
      referrer: config.referrer,
      rpcUrl: config.rpcUrl,
    });
  }

  /**
   * Estimates the fiat amount a cash-out would deliver for a USDC amount.
   *
   * @param args - The input arguments for the action.
   * @returns A message containing the oracle estimate.
   */
  @CreateAction({
    name: "estimate",
    description: `
This tool estimates the fiat amount a Peer Cash cash-out would deliver for a given USDC amount.

It takes:
- amountUsdc: The USDC amount to cash out, in whole units (e.g. '250' or '12.34')
- currency: The target fiat currency code (e.g. 'USD')
- includeEta: (Optional) Whether to include the historical time-to-fill estimate (default true)

Important notes:
- The result is an oracle market-rate estimate, not a locked quote. The binding rate resolves at the Chainlink oracle when a buyer fills the order, always with zero spread.
- The ETA is historical evidence (median time to first fill over the last 30 days), not a guarantee.
- Use the capabilities action to discover supported platforms and currencies.
`,
    schema: EstimateSchema,
  })
  async estimate(args: z.infer<typeof EstimateSchema>): Promise<string> {
    try {
      const estimate = await this.#client.estimate(
        // Currency support is validated by the SDK, which throws a typed
        // ORACLE_UNSUPPORTED_CURRENCY error for anything without a live feed.
        { amount: usdc(args.amountUsdc), currency: args.currency as CurrencyType },
        { includeEta: args.includeEta ?? true },
      );
      const eta = estimate.eta ? ` Estimated time to first fill: ${estimate.eta.label}.` : "";
      // Round the headline number for readability; the JSON below keeps full precision.
      const receive = Number(estimate.receiveAmount.toFixed(2));
      return (
        `Approximately ${receive} ${estimate.currency} for ${args.amountUsdc} USDC ` +
        `at the current oracle rate of ${estimate.rate} (zero spread). This is not a locked ` +
        `quote; the binding rate resolves when a buyer fills.${eta}\n` +
        JSON.stringify(estimateToJson(estimate), null, 2)
      );
    } catch (error) {
      return describeCashError("estimating the cash-out", error);
    }
  }

  /**
   * Lists the payout platforms, currencies, payee format hints, and amount
   * bounds Peer Cash supports, optionally with 30-day fill statistics.
   *
   * @param args - The input arguments for the action.
   * @returns A message containing the capability catalog.
   */
  @CreateAction({
    name: "capabilities",
    description: `
This tool lists what Peer Cash can pay out: payout platforms, the fiat currencies each platform supports, payee handle format hints, and USDC amount bounds.

It takes:
- includeFillStats: (Optional) Also include 30-day fill counts and median first-fill times per platform and currency pair (default false)

Important notes:
- Call this before the first cashout to pick a platform and currency and to learn the payee handle format from each platform's payeeHint.
- Platforms with requiresIdentityAttestation true (currently Wise and PayPal) only accept payee handles already registered with Peer; this provider cannot register a brand new handle for them.
- Fill stats are raw evidence. A reasonable availability gate is fills >= 10 and medianFillSeconds <= 48 hours; fail open to the full catalog when stats are unavailable.
`,
    schema: CapabilitiesSchema,
  })
  async capabilities(args: z.infer<typeof CapabilitiesSchema>): Promise<string> {
    const capabilities = this.#client.capabilities();
    const catalog =
      `Peer Cash payout capabilities (environment: ${capabilities.environment}):\n` +
      JSON.stringify(capabilitiesToJson(capabilities), null, 2);
    if (!args.includeFillStats) {
      return catalog;
    }
    try {
      const stats = await this.#client.fillStats();
      return `${catalog}\n30-day fill stats by pair:\n${JSON.stringify(fillStatsToJson(stats), null, 2)}`;
    } catch (error) {
      // Fill stats are an optional signal; fail open to the full catalog.
      return `${catalog}\n${describeCashError("reading fill stats (capabilities above are unaffected)", error)}`;
    }
  }

  /**
   * Creates a cash-out order: moves USDC from the wallet into the Peer escrow
   * contract, where a buyer pays fiat to the payee handle to earn it.
   *
   * @param walletProvider - The wallet provider that funds and signs the order.
   * @param args - The input arguments for the action.
   * @returns A message containing the deposit id and transaction details.
   */
  @CreateAction({
    name: "cashout",
    description: `
This tool cashes out USDC from the wallet to fiat in the user's payment app via the Peer P2P protocol.

It takes:
- amountUsdc: The USDC amount to cash out, in whole units (e.g. '250')
- platform: The payout platform id from the capabilities action (e.g. 'venmo')
- currency: The fiat currency to receive (e.g. 'USD'), or
- currencies: Several fiat currencies the buyer may choose between (e.g. ['EUR', 'GBP']); provide exactly one of currency or currencies
- payee: The payment handle that receives the fiat, formatted per the platform's payeeHint from the capabilities action

Important notes:
- This moves funds. The USDC leaves the wallet into the non-custodial Peer escrow contract; a buyer then pays fiat to the payee handle and proves the payment to release the USDC.
- The order fills at the live oracle market rate with zero spread. There is no locked quote.
- The returned depositId is the resume key. Persist it: the order_status, withdraw, and top_up actions all take it.
- Filling can take time. Poll with the order_status action; the withdraw action reclaims unfilled USDC at any time.
- If the platform is venmo, cashapp, or paypal, a follow-up access policy transaction is submitted automatically after the deposit confirms.
- If this tool reports that the deposit was created but the access policy failed, use the configure_access_policy action. Never create a second cash-out for the same funds.
`,
    schema: CashoutSchema,
  })
  async cashout(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CashoutSchema>,
  ): Promise<string> {
    try {
      const receive = (
        args.currencies !== undefined
          ? { platform: args.platform, currencies: args.currencies, payee: args.payee }
          : { platform: args.platform, currency: args.currency, payee: args.payee }
      ) as CashReceiveLeg;
      const input: CashoutInput = { amount: usdc(args.amountUsdc), receive };
      const prepared = await this.#client.prepare(input);

      let submitted: SubmittedStep[];
      try {
        submitted = await this.#submitPreparedPlan(walletProvider, prepared.txs, prepared.steps);
      } catch (error) {
        if (error instanceof StepRevertedError) {
          return (
            `Error: the ${error.step} transaction of the cash-out reverted ` +
            `(hash: ${error.txHash}). No cash-out order was created and no USDC is in escrow.`
          );
        }
        throw error;
      }

      const depositStep = submitted.find(step => step.kind === "createDeposit");
      if (!depositStep) {
        return "Error: the prepared cash-out plan had no createDeposit step; no order was created.";
      }
      const result = this.#client.finalizePreparedCashout({
        // Smart wallet providers return user operation receipts; their
        // transactionHash is the containing transaction that holds the logs.
        transactionHash: depositStep.receipt.transactionHash ?? depositStep.txHash,
        status: "success",
        logs: (depositStep.receipt.logs ?? []) as PreparedCashoutReceipt["logs"],
      });

      let accessPolicyNote = "";
      if (prepared.accessPolicyRequired) {
        try {
          const policyTxHash = await this.#submitAccessPolicy(walletProvider, result.depositId);
          accessPolicyNote = ` The restricted-platform access policy was configured (transaction: ${policyTxHash}).`;
        } catch (error) {
          const reason =
            error instanceof StepRevertedError
              ? `the access policy transaction reverted (hash: ${error.txHash})`
              : describeCashError("configuring the access policy", error);
          return (
            `Created Peer Cash cash-out order ${result.depositId} for ${args.amountUsdc} USDC on ` +
            `${args.platform} (deposit transaction: ${result.txHash}), but ${reason}. The USDC is ` +
            `already in escrow under this order, so never create another cash-out for the same ` +
            `funds. Retry the policy with the configure_access_policy action for deposit ` +
            `${result.depositId}, or use the withdraw action to unwind.`
          );
        }
      }

      const steps = submitted.map(step => `${step.kind}: ${step.txHash}`).join(", ");
      return (
        `Created Peer Cash cash-out order ${result.depositId} for ${args.amountUsdc} USDC on ` +
        `${args.platform} (transactions: ${steps}).${accessPolicyNote} The order is now ` +
        `${result.order.state}: a buyer pays fiat to '${args.payee}' at the live oracle rate ` +
        `and the escrow releases the USDC once the payment is proven. Track it with the ` +
        `order_status action; the withdraw action reclaims unfilled USDC at any time.`
      );
    } catch (error) {
      return describeCashError("creating the cash-out", error);
    }
  }

  /**
   * Reads the current state of a cash-out order by its deposit id.
   *
   * @param args - The input arguments for the action.
   * @returns A message containing the order state and details.
   */
  @CreateAction({
    name: "order_status",
    description: `
This tool reads the current state of a Peer Cash cash-out order by its deposit id.

It takes:
- depositId: The deposit id returned by the cashout action

The result includes the lifecycle state (awaiting-buyer, matched, delivering, delivered, or returned), a plain-language explanation, the allowed next actions (wait or withdraw), and per-fill receipts (locked rate, fiat owed, verified fiat paid, released USDC). Orders are resumable: any depositId can be inspected at any time, from any process.
`,
    schema: OrderStatusSchema,
  })
  async orderStatus(args: z.infer<typeof OrderStatusSchema>): Promise<string> {
    try {
      const order = await this.#client.order(args.depositId);
      return (
        `Order ${args.depositId} is ${order.state}. ${order.explain()} ` +
        `Next actions: ${order.nextActions.join(", ") || "none"}.\n` +
        JSON.stringify(orderToJson(order), null, 2)
      );
    } catch (error) {
      return describeCashError("reading the order status", error);
    }
  }

  /**
   * Lists cash-out orders owned by a wallet address.
   *
   * @param walletProvider - The wallet provider supplying the default address.
   * @param args - The input arguments for the action.
   * @returns A message containing the list of orders.
   */
  @CreateAction({
    name: "list_orders",
    description: `
This tool lists Peer Cash cash-out orders owned by a wallet.

It takes:
- address: (Optional) The wallet address to list orders for (defaults to the connected wallet)
- inFlightOnly: (Optional) Only return orders that still need attention: awaiting a buyer, matched, or delivering (default false)
`,
    schema: ListOrdersSchema,
  })
  async listOrders(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ListOrdersSchema>,
  ): Promise<string> {
    const owner = args.address ?? walletProvider.getAddress();
    try {
      const orders = await this.#client.orders(owner, args.inFlightOnly ? { inFlight: true } : {});
      if (orders.length === 0) {
        return `No Peer Cash orders found for ${owner}.`;
      }
      return (
        `Found ${orders.length} Peer Cash order(s) for ${owner}:\n` +
        JSON.stringify(orders.map(orderToJson), null, 2)
      );
    } catch (error) {
      return describeCashError("listing orders", error);
    }
  }

  /**
   * Withdraws USDC from a cash-out order back to the wallet.
   *
   * @param walletProvider - The wallet provider that signs the withdrawal.
   * @param args - The input arguments for the action.
   * @returns A message containing the withdrawal transaction details.
   */
  @CreateAction({
    name: "withdraw",
    description: `
This tool withdraws USDC from a Peer Cash cash-out order back to the wallet.

It takes:
- depositId: The deposit id of the order
- amountUsdc: (Optional) A partial USDC amount to withdraw; omit to close the order fully

Important notes:
- This is the single unwind verb. If a buyer never paid, their expired intent is pruned automatically and the USDC comes back; there is no separate cancel.
- A partial withdrawal takes only unlocked funds; a live buyer intent does not block it.
- Omitting amountUsdc closes the order and returns everything not already taken by proven fills.
`,
    schema: WithdrawSchema,
  })
  async withdraw(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof WithdrawSchema>,
  ): Promise<string> {
    try {
      const prepared = await this.#client.prepareWithdraw(
        args.depositId,
        args.amountUsdc !== undefined ? { amount: usdc(args.amountUsdc) } : {},
      );
      const submitted = await this.#submitPreparedPlan(
        walletProvider,
        prepared.txs,
        prepared.steps,
      );
      const steps = submitted.map(step => `${step.kind}: ${step.txHash}`).join(", ");
      const summary =
        args.amountUsdc !== undefined
          ? `Withdrew ${args.amountUsdc} USDC from order ${args.depositId}`
          : `Closed order ${args.depositId} and withdrew the remaining USDC`;
      return `${summary} (transactions: ${steps}).`;
    } catch (error) {
      if (error instanceof StepRevertedError) {
        return (
          `Error: the ${error.step} transaction of the withdrawal reverted ` +
          `(hash: ${error.txHash}). Check the order with the order_status action before retrying.`
        );
      }
      return describeCashError("withdrawing from the order", error);
    }
  }

  /**
   * Adds USDC to a live cash-out order.
   *
   * @param walletProvider - The wallet provider that funds and signs the top up.
   * @param args - The input arguments for the action.
   * @returns A message containing the top up transaction details.
   */
  @CreateAction({
    name: "top_up",
    description: `
This tool adds USDC to a live Peer Cash cash-out order.

It takes:
- depositId: The deposit id of the order
- amountUsdc: The USDC amount to add, in whole units (e.g. '100')

The added funds pay out to the same payee and fill at the same live oracle market rate. This moves funds from the wallet into the escrow contract.
`,
    schema: TopUpSchema,
  })
  async topUp(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof TopUpSchema>,
  ): Promise<string> {
    try {
      const prepared = await this.#client.prepareTopUp(args.depositId, usdc(args.amountUsdc));
      const submitted = await this.#submitPreparedPlan(
        walletProvider,
        prepared.txs,
        prepared.steps,
      );
      const steps = submitted.map(step => `${step.kind}: ${step.txHash}`).join(", ");
      return `Added ${args.amountUsdc} USDC to order ${args.depositId} (transactions: ${steps}).`;
    } catch (error) {
      if (error instanceof StepRevertedError) {
        return (
          `Error: the ${error.step} transaction of the top up reverted (hash: ${error.txHash}). ` +
          `The order is unchanged.`
        );
      }
      return describeCashError("topping up the order", error);
    }
  }

  /**
   * Retries the access policy transaction for a restricted cash-out whose
   * deposit exists but whose policy did not confirm.
   *
   * @param walletProvider - The wallet provider that signs the policy transaction.
   * @param args - The input arguments for the action.
   * @returns A message containing the policy transaction details.
   */
  @CreateAction({
    name: "configure_access_policy",
    description: `
This tool retries the access policy transaction for a restricted Peer Cash cash-out (venmo, cashapp, or paypal).

It takes:
- depositId: The deposit id of the order that still needs its access policy

Important notes:
- Only use this when a cashout reported that the deposit was created but the access policy transaction failed. The cashout action submits the policy automatically in the normal case.
- Never create a second cash-out to fix a policy failure; the USDC is already in escrow under the existing deposit id.
`,
    schema: ConfigureAccessPolicySchema,
  })
  async configureAccessPolicy(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ConfigureAccessPolicySchema>,
  ): Promise<string> {
    try {
      const txHash = await this.#submitAccessPolicy(walletProvider, args.depositId);
      return (
        `Access policy configured for order ${args.depositId} (transaction: ${txHash}). ` +
        `Intent signaling is now restricted to the required buyer groups.`
      );
    } catch (error) {
      if (error instanceof StepRevertedError) {
        return (
          `Error: the access policy transaction reverted (hash: ${error.txHash}). Inspect that ` +
          `transaction before retrying, and never create another cash-out for the same funds.`
        );
      }
      return describeCashError("configuring the access policy", error);
    }
  }

  /**
   * Checks if the Peer Cash action provider supports the given network.
   * Peer Cash settles exclusively on Base mainnet; the preproduction and
   * staging environments also run on Base mainnet with separate contracts.
   *
   * @param network - The network to check.
   * @returns True if the network is Base mainnet.
   */
  supportsNetwork(network: Network): boolean {
    return network.protocolFamily === "evm" && network.networkId === "base-mainnet";
  }

  /**
   * Submits the transactions of a prepared Peer Cash plan in order, waiting
   * for each receipt before continuing.
   *
   * Peer Cash's signed path wants a viem WalletClient, which an AgentKit
   * EvmWalletProvider is not guaranteed to expose (CDP server and smart
   * wallets sign remotely and cannot produce raw signed transactions). The
   * SDK's unsigned prepare path returns the exact transactions with a
   * same-index step plan, so this provider submits them through
   * walletProvider.sendTransaction and every AgentKit wallet provider works
   * unchanged.
   *
   * @param walletProvider - The wallet provider that signs and submits.
   * @param txs - The unsigned transactions, in submission order.
   * @param steps - The step labels, same order as the transactions.
   * @returns The submitted steps with their transaction hashes and receipts.
   */
  async #submitPreparedPlan(
    walletProvider: EvmWalletProvider,
    txs: PreparedTransaction[],
    steps: CashPreparedStep[],
  ): Promise<SubmittedStep[]> {
    const submitted: SubmittedStep[] = [];
    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      const kind = steps[i]?.kind ?? "transaction";
      const txHash = await walletProvider.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value,
      });
      const receipt = (await walletProvider.waitForTransactionReceipt(
        txHash,
      )) as TransactionReceiptLike;
      if (isRevertedReceipt(receipt)) {
        throw new StepRevertedError(kind, txHash);
      }
      submitted.push({ kind, txHash, receipt });
    }
    return submitted;
  }

  /**
   * Prepares, submits, and confirms the restricted-platform access policy
   * transaction for a deposit.
   *
   * @param walletProvider - The wallet provider that signs the policy transaction.
   * @param depositId - The deposit id to attach the policy to.
   * @returns The confirmed policy transaction hash.
   */
  async #submitAccessPolicy(
    walletProvider: EvmWalletProvider,
    depositId: string,
  ): Promise<`0x${string}`> {
    const policyTx = this.#client.prepareAccessPolicy(depositId);
    const txHash = await walletProvider.sendTransaction({
      to: policyTx.to,
      data: policyTx.data,
      value: policyTx.value,
    });
    const receipt = (await walletProvider.waitForTransactionReceipt(
      txHash,
    )) as TransactionReceiptLike;
    if (isRevertedReceipt(receipt)) {
      throw new StepRevertedError("accessPolicy", txHash);
    }
    return txHash;
  }
}

/**
 * Factory function to create a new PeerCashActionProvider instance.
 *
 * @param config - Configuration options, including the Peer environment and
 * an optional referral code for the integration share.
 * @returns A new PeerCashActionProvider instance.
 */
export const peerCashActionProvider = (config: PeerCashActionProviderConfig = {}) =>
  new PeerCashActionProvider(config);
