import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import {
  SendUsdcSchema,
  SendUsdcGaslessSchema,
  BatchPayUsdcSchema,
  CreateEscrowSchema,
  SubscribeSchema,
} from "./schemas";
import { encodeFunctionData, parseUnits, formatUnits, type Hex } from "viem";
import { EvmWalletProvider } from "../../wallet-providers";
import {
  PolicyProvider,
  ActionContext,
  PolicyDecision,
  PolicyOutcome,
} from "../../policy/interfaces";
import { actionContextHash, recipientAllocationHash } from "../../policy/utils";

const BASE_CHAIN_ID = "8453";
const BASESCAN = "https://basescan.org/tx";
const DEFAULT_RELAY_URL = "https://base-pay.replit.app";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const USDC_DECIMALS = 6;
const BATCH_PAY = "0xe40d2292c050566d16cecda74627b70778806c68" as const;
const ESCROW_V2 = "0x1eb2b1e8dda64fc4ccb0537574f2a2ca9f307499" as const;
const SUBSCRIPTION_MANAGER = "0x101918a252b3852ac4b50b7bbf2525d3084d5421" as const;

const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
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
] as const;

const BATCH_PAY_ABI = [
  {
    name: "batchSend",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "memo", type: "string" },
    ],
    outputs: [],
  },
] as const;

const ESCROW_ABI = [
  {
    name: "create",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "payee", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "ttl", type: "uint256" },
      { name: "memo", type: "string" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
] as const;

const SUBSCRIPTION_ABI = [
  {
    name: "subscribe",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "payee", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "interval", type: "uint256" },
      { name: "memo", type: "string" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
] as const;

function toAtomic(human: string): bigint {
  return parseUnits(human, USDC_DECIMALS);
}

function txLink(hash: Hex): string {
  return `${BASESCAN}/${hash}`;
}

async function ensureAllowance(
  walletProvider: EvmWalletProvider,
  spender: string,
  required: bigint,
): Promise<Hex | null> {
  const owner = walletProvider.getAddress();
  const current = await walletProvider.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner as Hex, spender as Hex],
  });
  if (typeof current === "bigint" && current >= required) return null;

  const approveTx = await walletProvider.sendTransaction({
    to: USDC,
    data: encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spender as Hex, required],
    }),
  });
  await walletProvider.waitForTransactionReceipt(approveTx);
  return approveTx;
}

export interface BasePayConfig {
  relayUrl?: string;
  policyProvider?: PolicyProvider;
}

/**
 * BasePayActionProvider provides AI agents with USDC payment primitives on Base Mainnet:
 * gasless EIP-3009 transfers, batch payments, time-locked escrow, and on-chain subscriptions.
 *
 * Contracts: https://github.com/osr21/basepay/blob/main/contracts/addresses.json
 * BasePay dApp: https://base-pay.replit.app
 */
export class BasePayActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly relayUrl: string;
  private readonly policyProvider?: PolicyProvider;
  private readonly pending = new Set<string>();
  private readonly consumed = new Set<string>();

  constructor(config?: BasePayConfig) {
    super("basepay", []);
    this.relayUrl = config?.relayUrl ?? DEFAULT_RELAY_URL;
    this.policyProvider = config?.policyProvider;
  }

  /**
   * checkPolicy evaluates the action context against the policy provider.
   *
   * Fix 1: pending.add(ref) is done here, synchronously, before returning —
   * so concurrent calls with the same decision_ref are blocked before any
   * async work in the caller, closing the race window in the two-set pattern.
   */
  private async recordPolicyOutcome(
    decision: PolicyDecision | null,
    outcome: PolicyOutcome,
    extras: { tx_hash?: Hex; error?: string } = {},
  ): Promise<void> {
    if (!decision || !this.policyProvider?.record) return;

    try {
      await this.policyProvider.record({
        decision,
        outcome,
        tx_hash: extras.tx_hash,
        error: extras.error,
        issued_at_ms: Date.now(),
      });
    } catch {
      // Receipt recording is best-effort and must not block settlement.
    }
  }

  private classifyPolicyError(error: unknown): PolicyOutcome {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("policy_denied")) return "denied";
    if (message.includes("policy_unverifiable")) return "expired";
    if (message.includes("context_drift")) return "context_drift";
    if (message.includes("unbound_execution")) return "unauditable_outcome";
    return "failed";
  }

  private async checkPolicy(ctx: ActionContext): Promise<PolicyDecision | null> {
    if (!this.policyProvider) return null;

    const decision = await this.policyProvider.evaluate(ctx);
    if (!decision.allowed) {
      await this.recordPolicyOutcome(decision, "denied", {
        error: `policy_denied: ${decision.reason_codes?.join(", ") || "no reason"}`,
      });
      throw new Error(`policy_denied: ${decision.reason_codes?.join(", ") || "no reason"}`);
    }
    if (!decision.decision_ref) {
      await this.recordPolicyOutcome(decision, "unauditable_outcome", {
        error: "unbound_execution",
      });
      throw new Error("unbound_execution");
    }
    if (Date.now() > decision.expires_at_ms) {
      await this.recordPolicyOutcome(decision, "expired", { error: "policy_unverifiable" });
      throw new Error("policy_unverifiable");
    }

    const expectedHash = await actionContextHash(ctx);
    if (decision.action_context_hash !== expectedHash) {
      await this.recordPolicyOutcome(decision, "context_drift", { error: "context_drift" });
      throw new Error("context_drift");
    }

    if (this.pending.has(decision.decision_ref) || this.consumed.has(decision.decision_ref)) {
      await this.recordPolicyOutcome(decision, "denied", {
        error: "unbound_execution",
      });
      throw new Error("unbound_execution");
    }

    // Fix 1: add to pending inside checkPolicy before returning.
    // This ensures the concurrent-duplicate guard fires before any caller
    // async work, not after checkPolicy returns.
    this.pending.add(decision.decision_ref);
    return decision;
  }

  @CreateAction({
    name: "basepay_send_usdc",
    description: `
  Send USDC to any address on Base Mainnet. The agent wallet pays ETH gas.

  Inputs:
  - to: recipient Ethereum address (0x…)
  - amount: USDC amount as a decimal string (e.g. "10.5" for 10.5 USDC)

  Requirements: agent wallet must hold USDC and ETH for gas (~0.0002 ETH typical).
  Returns: transaction hash and Basescan link.
  `.trim(),
    schema: SendUsdcSchema,
  })
  async sendUsdc(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SendUsdcSchema>,
  ): Promise<string> {
    const ctx: ActionContext = {
      action: "basepay_send_usdc",
      to: args.to,
      amount_usdc: args.amount,
      transfer_mechanism: "direct",
    };

    let decision: PolicyDecision | null = null;
    let ref = "";
    try {
      decision = await this.checkPolicy(ctx);
      ref = decision?.decision_ref ?? "";
      // Fix 1 (caller): pending.add is now inside checkPolicy; only consumed.add here.
      if (ref) this.consumed.add(ref);

      const hash = await walletProvider.sendTransaction({
        to: USDC,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "transfer",
          args: [args.to as Hex, toAtomic(args.amount)],
        }),
      });
      // Fix 5: classify on-chain revert as [failed], not [executed].
      const receipt = await walletProvider.waitForTransactionReceipt(hash);
      if ((receipt as { status?: string }).status === "reverted") {
        await this.recordPolicyOutcome(decision, "failed", { tx_hash: hash });
        return `Error: transaction reverted on-chain. [failed]\nTransaction: ${txLink(hash)}`;
      }
      await this.recordPolicyOutcome(decision, "executed", { tx_hash: hash });
      return `Sent ${args.amount} USDC to ${args.to} [executed]\nTransaction: ${txLink(hash)}`;
    } catch (e: unknown) {
      await this.recordPolicyOutcome(decision, this.classifyPolicyError(e), {
        error: e instanceof Error ? e.message : String(e),
      });
      return `Error sending USDC: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      if (ref) this.pending.delete(ref);
    }
  }

  @CreateAction({
    name: "basepay_send_usdc_gasless",
    description: `
  Send USDC gaslessly via the BasePay EIP-3009 relay — the relay pays ETH gas, the agent needs NO ETH.

  How it works:
  1. Agent signs a TransferWithAuthorization EIP-712 typed message (no on-chain tx)
  2. BasePay relay submits the authorization to USDC.transferWithAuthorization()
  3. USDC moves directly from agent wallet to recipient

  Inputs:
  - to: recipient Ethereum address (0x…)
  - amount: USDC decimal (e.g. "5"). Max 1,000,000 USDC.

  Requirements: wallet must support signTypedData (ViemWalletProvider, CdpEvmWalletProvider).
  Returns: relay transaction hash and Basescan link.
  `.trim(),
    schema: SendUsdcGaslessSchema,
  })
  async sendUsdcGasless(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SendUsdcGaslessSchema>,
  ): Promise<string> {
    const ctx: ActionContext = {
      action: "basepay_send_usdc_gasless",
      to: args.to,
      amount_usdc: args.amount,
      transfer_mechanism: "eip3009",
    };

    let decision: PolicyDecision | null = null;
    let ref = "";
    try {
      decision = await this.checkPolicy(ctx);
      ref = decision?.decision_ref ?? "";
      // Fix 1 (caller): pending.add is inside checkPolicy.
      // Fix 2: consumed.add is here, before signTypedData — signing is the first
      // irreversible authority step (a signed EIP-3009 auth is spend-capable even
      // if the relay is never called). The post-relay consumed.add has been removed.
      if (ref) this.consumed.add(ref);

      const wp = walletProvider as EvmWalletProvider & {
        signTypedData?: (p: Record<string, unknown>) => Promise<Hex>;
      };
      if (typeof wp.signTypedData !== "function") {
        await this.recordPolicyOutcome(decision, "failed", {
          error: "wallet provider does not support signTypedData",
        });
        return (
          "Error: wallet provider does not support signTypedData. " +
          "Use ViemWalletProvider or CdpEvmWalletProvider for gasless transfers."
        );
      }

      const from = walletProvider.getAddress();
      const value = toAtomic(args.amount);
      const validAfter = "0";
      const validBefore = String(Math.floor(Date.now() / 1000) + 3600);
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      const nonce = ("0x" +
        Array.from(randomBytes)
          .map(b => b.toString(16).padStart(2, "0"))
          .join("")) as Hex;

      let signature: Hex;
      try {
        signature = await wp.signTypedData({
          domain: { name: "USD Coin", version: "2", chainId: 8453, verifyingContract: USDC },
          types: {
            TransferWithAuthorization: [
              { name: "from", type: "address" },
              { name: "to", type: "address" },
              { name: "value", type: "uint256" },
              { name: "validAfter", type: "uint256" },
              { name: "validBefore", type: "uint256" },
              { name: "nonce", type: "bytes32" },
            ],
          },
          primaryType: "TransferWithAuthorization",
          message: {
            from,
            to: args.to,
            value,
            validAfter: BigInt(validAfter),
            validBefore: BigInt(validBefore),
            nonce,
          },
        });
      } catch (e: unknown) {
        await this.recordPolicyOutcome(decision, "failed", {
          error: e instanceof Error ? e.message : String(e),
        });
        return `Error signing EIP-3009 authorization: ${e instanceof Error ? e.message : String(e)}`;
      }

      const sigHex = signature.slice(2);
      const r = ("0x" + sigHex.slice(0, 64)) as Hex;
      const s = ("0x" + sigHex.slice(64, 128)) as Hex;
      const vByte = parseInt(sigHex.slice(128, 130), 16);
      const v = vByte < 27 ? vByte + 27 : vByte;

      try {
        const resp = await fetch(`${this.relayUrl}/api/gasless/relay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: args.to,
            value: value.toString(),
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s,
          }),
        });
        const data = (await resp.json()) as { txHash?: string; error?: string };
        if (!resp.ok || data.error) {
          await this.recordPolicyOutcome(decision, "failed", {
            error: `Relay error: ${data.error ?? resp.statusText}`,
          });
          return `Relay error: ${data.error ?? resp.statusText}`;
        }
        await this.recordPolicyOutcome(decision, "relay_confirmed", {
          tx_hash: data.txHash as Hex,
        });
        // Fix 6: relay accepted the authorization and returned a tx hash, but chain
        // confirmation is not awaited. Outcome is relay_confirmed, not executed.
        return `Gaslessly sent ${args.amount} USDC to ${args.to} (relay paid gas) [relay_confirmed]\nTransaction: ${txLink(data.txHash as Hex)}`;
      } catch (e: unknown) {
        await this.recordPolicyOutcome(decision, "failed", {
          error: e instanceof Error ? e.message : String(e),
        });
        return `Error calling BasePay relay: ${e instanceof Error ? e.message : String(e)}`;
      }
    } finally {
      if (ref) this.pending.delete(ref);
    }
  }

  @CreateAction({
    name: "basepay_batch_pay_usdc",
    description: `
  Pay up to 200 recipients USDC atomically in one transaction. Auto-approves allowance if needed.

  Inputs:
  - recipients: array of { address, amount } (max 200). address is a 0x Ethereum address; amount is USDC decimal.
  - memo: optional string recorded on-chain (max 64 chars)

  Returns: recipient count, total USDC, and Basescan link.
  `.trim(),
    schema: BatchPayUsdcSchema,
  })
  async batchPayUsdc(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof BatchPayUsdcSchema>,
  ): Promise<string> {
    const amounts = args.recipients.map(r => toAtomic(r.amount));
    const total = amounts.reduce((a, b) => a + b, 0n);

    const ctx: ActionContext = {
      action: "basepay_batch_pay_usdc",
      recipient_allocation_hash: await recipientAllocationHash(
        args.recipients.map(r => ({ address: r.address, amount: toAtomic(r.amount) })),
      ),
      recipient_count: args.recipients.length,
      aggregate_usdc: formatUnits(total, USDC_DECIMALS),
      transfer_mechanism: "direct",
    };

    let decision: PolicyDecision | null = null;
    let ref = "";
    try {
      decision = await this.checkPolicy(ctx);
      ref = decision?.decision_ref ?? "";
      // Fix 1 (caller): pending.add is inside checkPolicy.
      if (ref) this.consumed.add(ref);

      // Fix 3: re-derive recipient_allocation_hash at the execution boundary,
      // before any allowance change, to close the TOCTOU window between
      // policy evaluation and execution.
      if (ctx.recipient_allocation_hash !== undefined) {
        const execHash = await recipientAllocationHash(
          args.recipients.map(r => ({ address: r.address, amount: toAtomic(r.amount) })),
        );
        if (execHash !== ctx.recipient_allocation_hash) {
          throw new Error("context_drift");
        }
      }

      const approveTx = await ensureAllowance(walletProvider, BATCH_PAY, total);
      const hash = await walletProvider.sendTransaction({
        to: BATCH_PAY,
        data: encodeFunctionData({
          abi: BATCH_PAY_ABI,
          functionName: "batchSend",
          args: [USDC, args.recipients.map(r => r.address as Hex), amounts, args.memo],
        }),
      });
      // Fix 5: classify on-chain revert as [failed].
      const receipt = await walletProvider.waitForTransactionReceipt(hash);
      if ((receipt as { status?: string }).status === "reverted") {
        await this.recordPolicyOutcome(decision, "failed", { tx_hash: hash });
        return `Error: batch payment reverted on-chain. [failed]\nTransaction: ${txLink(hash)}`;
      }
      await this.recordPolicyOutcome(decision, "executed", { tx_hash: hash });
      return [
        `Batch payment: ${args.recipients.length} recipients, ${formatUnits(total, USDC_DECIMALS)} USDC [executed]`,
        ...(approveTx ? [`Approve: ${txLink(approveTx)}`] : []),
        `Batch tx: ${txLink(hash)}`,
      ].join("\n");
    } catch (e: unknown) {
      await this.recordPolicyOutcome(decision, this.classifyPolicyError(e), {
        error: e instanceof Error ? e.message : String(e),
      });
      return `Error in batch payment: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      if (ref) this.pending.delete(ref);
    }
  }

  @CreateAction({
    name: "basepay_create_escrow",
    description: `
  Lock USDC in a time-locked escrow. The payee can claim after the unlock period; the payer can refund before it.

  Inputs:
  - payee: address that can claim USDC after unlock (0x…)
  - amount: USDC to lock (e.g. "100")
  - unlockAfterSeconds: seconds until the payee can claim (min 60). Example: 86400 = 1 day.
  - memo: optional on-chain label (max 64 chars)

  Returns: escrow ID, unlock time, and Basescan links.
  `.trim(),
    schema: CreateEscrowSchema,
  })
  async createEscrow(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CreateEscrowSchema>,
  ): Promise<string> {
    const amount = toAtomic(args.amount);

    const ctx: ActionContext = {
      action: "basepay_create_escrow",
      to: args.payee,
      amount_usdc: args.amount,
      transfer_mechanism: "direct",
      creates_commitment: true,
    };

    let decision: PolicyDecision | null = null;
    let ref = "";
    try {
      decision = await this.checkPolicy(ctx);
      ref = decision?.decision_ref ?? "";
      // Fix 1 (caller): pending.add is inside checkPolicy.
      if (ref) this.consumed.add(ref);

      const approveTx = await ensureAllowance(walletProvider, ESCROW_V2, amount);
      const hash = await walletProvider.sendTransaction({
        to: ESCROW_V2,
        data: encodeFunctionData({
          abi: ESCROW_ABI,
          functionName: "create",
          args: [USDC, args.payee as Hex, amount, BigInt(args.unlockAfterSeconds), args.memo],
        }),
      });
      // Fix 5: classify on-chain revert as [failed].
      const receipt = await walletProvider.waitForTransactionReceipt(hash);
      if ((receipt as { status?: string }).status === "reverted") {
        await this.recordPolicyOutcome(decision, "failed", { tx_hash: hash });
        return `Error: escrow creation reverted on-chain. [failed]\nTransaction: ${txLink(hash)}`;
      }
      const escrowId =
        (receipt as { logs?: { topics?: string[] }[] })?.logs?.[0]?.topics?.[1] ?? "see tx";
      await this.recordPolicyOutcome(decision, "executed", { tx_hash: hash });
      return [
        `Escrow created: ${args.amount} USDC for ${args.payee} [executed]`,
        `Unlock in: ${(args.unlockAfterSeconds / 86400).toFixed(1)} days`,
        `Escrow ID: ${escrowId}`,
        ...(approveTx ? [`Approve: ${txLink(approveTx)}`] : []),
        `Create tx: ${txLink(hash)}`,
      ].join("\n");
    } catch (e: unknown) {
      await this.recordPolicyOutcome(decision, this.classifyPolicyError(e), {
        error: e instanceof Error ? e.message : String(e),
      });
      return `Error creating escrow: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      if (ref) this.pending.delete(ref);
    }
  }

  @CreateAction({
    name: "basepay_subscribe",
    description: `
  Create a recurring on-chain USDC subscription. Anyone can call charge() once per interval.

  Inputs:
  - payee: address that receives USDC each period (0x…)
  - amount: USDC per interval (e.g. "9.99")
  - intervalSeconds: seconds between charges (e.g. 604800 weekly, 2592000 monthly)
  - memo: optional on-chain label (max 64 chars)

  Auto-approves SubscriptionManager for 24× the per-period amount (24 billing cycles).
  Returns: subscription ID, Basescan link.
  `.trim(),
    schema: SubscribeSchema,
  })
  async subscribe(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SubscribeSchema>,
  ): Promise<string> {
    const amount = toAtomic(args.amount);

    const ctx: ActionContext = {
      action: "basepay_subscribe",
      to: args.payee,
      amount_usdc: args.amount,
      transfer_mechanism: "direct",
      creates_recurring_obligation: true,
    };

    let decision: PolicyDecision | null = null;
    let ref = "";
    try {
      decision = await this.checkPolicy(ctx);
      ref = decision?.decision_ref ?? "";
      // Fix 1 (caller): pending.add is inside checkPolicy.
      // decision_ref scopes to subscription creation only; subsequent charge()
      // calls are a separate authority plane and do not inherit this ref.
      if (ref) this.consumed.add(ref);

      const approveTx = await ensureAllowance(walletProvider, SUBSCRIPTION_MANAGER, amount * 24n);
      const hash = await walletProvider.sendTransaction({
        to: SUBSCRIPTION_MANAGER,
        data: encodeFunctionData({
          abi: SUBSCRIPTION_ABI,
          functionName: "subscribe",
          args: [USDC, args.payee as Hex, amount, BigInt(args.intervalSeconds), args.memo],
        }),
      });
      // Fix 5: classify on-chain revert as [failed].
      const receipt = await walletProvider.waitForTransactionReceipt(hash);
      if ((receipt as { status?: string }).status === "reverted") {
        await this.recordPolicyOutcome(decision, "failed", { tx_hash: hash });
        return `Error: subscription creation reverted on-chain. [failed]\nTransaction: ${txLink(hash)}`;
      }
      const period =
        args.intervalSeconds === 604800
          ? "weekly"
          : args.intervalSeconds === 2592000
            ? "monthly"
            : `every ${args.intervalSeconds}s`;
      await this.recordPolicyOutcome(decision, "executed", { tx_hash: hash });
      return [
        `Subscription created: ${args.amount} USDC ${period} to ${args.payee} [executed]`,
        `Anyone can call charge() once per interval`,
        ...(approveTx ? [`Approve: ${txLink(approveTx)}`] : []),
        `Subscribe tx: ${txLink(hash)}`,
      ].join("\n");
    } catch (e: unknown) {
      await this.recordPolicyOutcome(decision, this.classifyPolicyError(e), {
        error: e instanceof Error ? e.message : String(e),
      });
      return `Error creating subscription: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      if (ref) this.pending.delete(ref);
    }
  }

  supportsNetwork(network: Network): boolean {
    return network.chainId === BASE_CHAIN_ID;
  }
}

export function basePayActionProvider(config?: BasePayConfig): BasePayActionProvider {
  return new BasePayActionProvider(config);
}
