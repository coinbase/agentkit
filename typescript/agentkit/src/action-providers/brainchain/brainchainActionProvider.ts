import { z } from "zod";
import { keccak256, toBytes } from "viem";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { GetTaskSchema, PostTaskSchema } from "./schemas";
import {
  BRAINCHAIN_NETWORKS,
  BrainChainNetworkId,
  MAX_TIMEOUT_SECONDS,
  RESULT_LIMIT,
  USDC_UNITS,
} from "./constants";

/** How long get_task waits for an order by default, and how often it reads it meanwhile. */
const DEFAULT_WAIT_SECONDS = 45;
const POLL_SECONDS = 10;

/**
 * Configuration for the BrainChain action provider.
 */
export interface BrainChainConfig {
  /** Most this provider pays for one task, in USDC. Defaults to 1. */
  maxPriceUsdc?: number;
  /** Most this provider pays in total while it exists, in USDC. Defaults to 10. */
  budgetUsdc?: number;
}

type Desk = (typeof BRAINCHAIN_NETWORKS)[BrainChainNetworkId];

const sameAddress = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const usdc = (units: bigint) => `${Number(units) / USDC_UNITS} USDC`;

/**
 * The desk names an order after the hash of the signed payment, with keys sorted,
 * so an order can be found even when the desk's reply never arrived.
 *
 * @param value - The signed payment's payload
 * @returns Canonical JSON of the payload
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const source = value as Record<string, unknown>;
  return `{${Object.keys(source)
    .filter(key => source[key] !== undefined)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonical(source[key])}`)
    .join(",")}}`;
}

/**
 * Turns an unknown error into one line.
 *
 * @param error - The error
 * @returns Its message
 */
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * What an order's state means and when to read it again.
 *
 * @param view - The order as the desk serves it
 * @param desk - The desk the order was paid on
 * @returns Whether the order is finished, what to do next, and when to read it again
 */
function guidance(
  view: Record<string, unknown>,
  desk: Desk,
): { done: boolean; next: string; retryAfterSeconds?: number } {
  const task = (view.task ?? {}) as { status?: string; accepted?: boolean };
  const wait = (retryAfterSeconds: number, next: string) => ({
    done: false,
    next,
    retryAfterSeconds,
  });
  switch (view.state) {
    case "paid-out":
      return {
        done: true,
        next:
          typeof view.resultText === "string"
            ? "Jev accepted the work and the model was paid; the result is in resultText."
            : "Jev accepted the work and the model was paid.",
      };
    case "refunded":
      return {
        done: true,
        next: `The work was not accepted and the full amount was refunded${typeof view.refundTx === "string" ? ` in ${view.refundTx}` : ""}.`,
      };
    case "refund-failed":
      return {
        done: true,
        next: "The refund could not be sent automatically. Write to hello@usebrainchain.com with this order id.",
      };
    case "failed":
      return {
        done: true,
        next: "The payment did not settle: nothing was charged and no task was posted.",
      };
    case "paying":
    case "paid":
    case "posting":
      return wait(20, "The payment is settling and the task is being posted.");
    case "unconfirmed":
      return wait(
        30,
        "The payment may have gone through and is being checked against the chain. Do not post the task again.",
      );
    case "refunding":
      return wait(60, "The work was not accepted; the refund is being sent.");
  }
  if (task.accepted === true) {
    if (typeof view.resultText !== "string") {
      return wait(60, "Jev accepted the work; the result is being prepared.");
    }
    return {
      done: true,
      next: `Jev accepted the work; the result is in resultText. The model is paid when the dispute window closes, ${desk.finalAfter} after grading.`,
    };
  }
  if (task.accepted === false) {
    return {
      done: true,
      next: `Jev did not accept the work, so the result is withheld. The full amount is refunded when the dispute window closes, ${desk.finalAfter} after grading.`,
    };
  }
  switch (task.status) {
    case "open":
      return wait(60, "Waiting for Jev to hire a model.");
    case "hired":
      return wait(60, "A model is working on the task.");
    case "delivered":
    case "submitted":
      return wait(30, "The model delivered; Jev is grading the work.");
    case "disputed":
      return wait(600, "The grade is disputed; Jev will rule on it.");
  }
  return wait(60, "The order is in progress.");
}

/**
 * BrainChainActionProvider lets an agent hand a task to a frontier model on
 * BrainChain and pay only for accepted work. Jev, a disclosed decision model,
 * hires one of Claude, GPT, Gemini, Grok or DeepSeek, grades the result against
 * the agent's quality levels, and pays the model only if the work passes. The
 * agent pays 1 USDC on Base over x402 from its own wallet; work that is not
 * accepted is refunded to that wallet.
 */
export class BrainChainActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly maxPrice: bigint;
  private readonly budget: bigint;
  private spent = 0n;

  /**
   * Creates a new BrainChainActionProvider.
   *
   * @param config - Spending limits per task and in total
   */
  constructor(config: BrainChainConfig = {}) {
    super("brainchain", []);
    const maxPrice = config.maxPriceUsdc ?? 1;
    const budget = config.budgetUsdc ?? 10;
    if (!(maxPrice > 0) || !(budget > 0)) {
      throw new Error("maxPriceUsdc and budgetUsdc must be positive numbers");
    }
    this.maxPrice = BigInt(Math.round(maxPrice * USDC_UNITS));
    this.budget = BigInt(Math.round(budget * USDC_UNITS));
  }

  /**
   * Pays for a task on BrainChain.
   *
   * @param walletProvider - The wallet that pays
   * @param args - The title, brief and quality levels
   * @returns JSON with the order id, the price paid and where to read the order
   */
  @CreateAction({
    name: "post_task",
    description: `Pay for a task on BrainChain. Jev, a decision model from TypeSafe, hires a frontier model (Claude, GPT, Gemini, Grok or DeepSeek) for the brief, grades the result against your quality levels, and pays the model only if the work reaches the second level or better.

Costs 1 USDC on Base, paid from this wallet over x402. If the work is not accepted, or no model delivers within 24 hours, the full amount is refunded to this wallet.

Briefs and accepted results are public: never include credentials, private code or personal data.

Inputs:
- title: one line naming the deliverable (up to 120 characters)
- brief: everything needed to do the work alone (up to 32,000 characters)
- levels: two or three quality levels, best first, each checkable from the result (up to 200 characters each)

Returns an order id; read it with get_task until done. If the reply says possiblyCharged, do not post again: read the order.`,
    schema: PostTaskSchema,
  })
  async postTask(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof PostTaskSchema>,
  ): Promise<string> {
    const desk = this.deskFor(walletProvider.getNetwork());
    if (!desk) {
      return JSON.stringify({
        error:
          "BrainChain takes payment on Base mainnet and Base Sepolia only. Nothing was charged.",
      });
    }
    const endpoint = `${desk.desk}/x402/tasks`;
    let signed: { payload: unknown } | undefined;
    let amount = 0n;

    const client = new x402Client();
    const account = walletProvider.toSigner();
    registerExactEvmScheme(client, {
      signer: {
        ...account,
        readContract: (call: {
          address: `0x${string}`;
          abi: readonly unknown[];
          functionName: string;
          args?: readonly unknown[];
        }) =>
          walletProvider.readContract({
            address: call.address,
            abi: call.abi as never,
            functionName: call.functionName as never,
            args: call.args as never,
          }),
      },
    });
    // Pay only BrainChain's desk, in USDC, within the per-task cap.
    client.registerPolicy((_version, requirements) =>
      requirements.filter(
        r =>
          r.network === desk.network &&
          sameAddress(r.asset, desk.usdc) &&
          sameAddress(r.payTo, desk.payTo) &&
          BigInt(r.amount) <= this.maxPrice &&
          r.maxTimeoutSeconds <= MAX_TIMEOUT_SECONDS,
      ),
    );
    // Reserved before signing, so parallel posts cannot overshoot the budget.
    client.onBeforePaymentCreation(async ({ selectedRequirements }) => {
      const price = BigInt(selectedRequirements.amount);
      if (this.spent + price > this.budget) {
        return {
          abort: true,
          reason: `This provider's budget of ${usdc(this.budget)} would be exceeded`,
        };
      }
      this.spent += price;
      amount = price;
    });
    client.onAfterPaymentCreation(async ({ paymentPayload }) => {
      signed = paymentPayload;
    });
    client.onPaymentCreationFailure(async () => {
      if (signed) return;
      this.spent -= amount;
      amount = 0n;
    });

    const receipt = (order: string) => ({
      order,
      price: usdc(amount),
      statusUrl: `${endpoint}/${order}`,
    });
    const orderOf = (payment: { payload: unknown }) =>
      keccak256(toBytes(canonical(payment.payload)));

    let response: Response;
    try {
      response = await wrapFetchWithPayment(fetch, client)(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(45_000),
      });
    } catch (error) {
      if (signed) {
        return JSON.stringify({
          ...receipt(orderOf(signed)),
          possiblyCharged: true,
          next: `The payment was signed but the desk did not confirm the order (${message(error)}). Read the order with get_task; do not post again.`,
        });
      }
      this.spent -= amount;
      return JSON.stringify({ error: `${message(error)}. Nothing was charged.` });
    }

    const reply = ((await response.json().catch(() => undefined)) ?? {}) as Record<string, unknown>;
    if (response.ok && signed) {
      const order = typeof reply.order === "string" ? reply.order : orderOf(signed);
      return JSON.stringify({
        ...receipt(order),
        ...(typeof reply.state === "string" ? { state: reply.state } : {}),
        next: "Read the order with get_task, which waits for progress; results usually arrive within minutes.",
      });
    }
    // The desk refuses a brief (400) or a payment (402) before settling; any
    // other answer to a signed payment may have charged it.
    if (signed && response.status !== 400 && response.status !== 402) {
      const order = typeof reply.order === "string" ? reply.order : orderOf(signed);
      return JSON.stringify({
        ...receipt(order),
        possiblyCharged: true,
        next: `The desk answered ${response.status}. Read the order with get_task; do not post again.`,
      });
    }
    this.spent -= amount;
    const reason =
      typeof reply.error === "string" ? reply.error : `The desk answered ${response.status}.`;
    return JSON.stringify({ error: `${reason} Nothing was charged.` });
  }

  /**
   * Reads an order from post_task.
   *
   * @param walletProvider - The wallet whose network names the desk
   * @param args - The order id
   * @returns JSON with the order's state, Jev's grade, the result once accepted, and what to do next
   */
  @CreateAction({
    name: "get_task",
    description: `Read a BrainChain order from post_task: the payment, the task's status, whether Jev accepted the work, the result text once it did, and the refund if it did not.

Inputs:
- order: the order id returned by post_task
- waitSeconds: optional, how long to wait for the order to finish before answering (default 45)

Waits for progress before answering. Call again until done is true.`,
    schema: GetTaskSchema,
  })
  async getTask(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetTaskSchema>,
  ): Promise<string> {
    const desk = this.deskFor(walletProvider.getNetwork());
    if (!desk) {
      return JSON.stringify({
        error: "BrainChain orders are read on Base mainnet and Base Sepolia only.",
      });
    }
    // A model cannot pause between calls, so the action waits for progress itself.
    const deadline = Date.now() + (args.waitSeconds ?? DEFAULT_WAIT_SECONDS) * 1000;
    for (;;) {
      const view = await this.readOrder(desk, args.order);
      if (view.done || Date.now() + POLL_SECONDS * 1000 > deadline) return JSON.stringify(view);
      await new Promise(resolve => setTimeout(resolve, POLL_SECONDS * 1000));
    }
  }

  /**
   * Checks if the action provider supports the given network.
   *
   * @param network - The network to check
   * @returns True on Base mainnet and Base Sepolia
   */
  supportsNetwork = (network: Network) => this.deskFor(network) !== undefined;

  /**
   * Reads an order once.
   *
   * @param desk - The desk the order was paid on
   * @param order - The order id
   * @returns The order with what its state means and when to read it again
   */
  private async readOrder(desk: Desk, order: string): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetch(`${desk.desk}/x402/tasks/${order}`, {
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      return {
        order,
        error: `Could not reach the desk (${message(error)})`,
        done: false,
        retryAfterSeconds: 30,
      };
    }
    if (response.status === 404) {
      return {
        order,
        error: "The desk has no order with this id",
        done: false,
        next: "If post_task said possiblyCharged, the payment may still be settling: read the order again in a minute.",
        retryAfterSeconds: 60,
      };
    }
    if (!response.ok) {
      return {
        order,
        error: `The desk answered ${response.status}`,
        done: false,
        retryAfterSeconds: 60,
      };
    }
    const view = (await response.json()) as Record<string, unknown>;
    // Only results served by the desk itself are fetched; anything else stays a link.
    if (typeof view.result === "string" && view.result.startsWith(`${desk.desk}/records/`)) {
      try {
        const text = await fetch(view.result, { signal: AbortSignal.timeout(20_000) });
        if (text.ok) {
          const full = await text.text();
          view.resultText =
            full.length <= RESULT_LIMIT
              ? full
              : `${full.slice(0, RESULT_LIMIT)}\n\n[Cut at ${RESULT_LIMIT} of ${full.length} characters; the full result is at ${view.result}]`;
        }
      } catch {
        view.resultError = `The result could not be fetched; it is at ${view.result}`;
      }
    }
    return { ...view, ...guidance(view, desk) };
  }

  /**
   * The desk that takes payment on a network.
   *
   * @param network - The wallet's network
   * @returns The desk, or undefined where BrainChain takes no payment
   */
  private deskFor(network: Network): Desk | undefined {
    if (network.protocolFamily !== "evm" || !network.networkId) return undefined;
    return BRAINCHAIN_NETWORKS[network.networkId as BrainChainNetworkId];
  }
}

export const brainchainActionProvider = (config?: BrainChainConfig) =>
  new BrainChainActionProvider(config);
