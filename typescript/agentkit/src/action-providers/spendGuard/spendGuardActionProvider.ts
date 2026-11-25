import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { GuardBatchSchema } from "./schemas";
import { DEFAULT_SPEND_GUARD_URL } from "./constants";

/**
 * SpendGuardActionProvider gives an agent a spend and limit firewall: it sends
 * a batch of limit operations to a guard endpoint and learns whether the whole
 * batch fits before anything happens. The batch is atomic — all applied or none.
 *
 * The endpoint is an HTTP contract (`POST {url}/v1/guard` with `{orders}`), so
 * any compatible server can be used through the `SPEND_GUARD_URL` environment
 * variable or the constructor argument.
 */
export class SpendGuardActionProvider extends ActionProvider {
  private readonly guardUrl: string;

  /**
   * Constructor for the SpendGuardActionProvider class.
   *
   * @param guardUrl - Base URL of the guard service (defaults to SPEND_GUARD_URL)
   */
  constructor(guardUrl: string = DEFAULT_SPEND_GUARD_URL) {
    super("spendGuard", []);
    this.guardUrl = guardUrl.replace(/\/$/, "");
  }

  /**
   * Validates and applies a batch of limit operations atomically.
   *
   * @param args - The batch of orders and the tenant slot
   * @returns The guard decision as JSON, or a message explaining the payment/error
   */
  @CreateAction({
    name: "guard_batch",
    description: `This tool decides whether a batch of spend and limit changes is allowed BEFORE the agent acts:
daily budget, per-call cap, API rate, writes, transfers, token burn, queue batch size, retries and session lock.
It takes:
- A list of orders, each with a limit (root), an action (READ, SET, INCREASE, DECREASE, OPEN, CLOSE, STOP), an optional value (in the limit's own scale) or value_dec (human units), and an optional lock flag
- An optional tenant slot that keeps the state isolated

The batch is atomic: it is applied completely or not at all.
Returns {"ok": true, "codes": "0"} when the whole batch fits, or {"ok": false, "codes": "M"} when a limit blocks it (and then nothing is applied).
Call this before spending, writing or transferring. The first 5 actions of a batch are free; larger batches may answer HTTP 402 and can be paid with the x402 provider.`,
    schema: GuardBatchSchema,
  })
  async guardBatch(args: z.infer<typeof GuardBatchSchema>): Promise<string> {
    const cuerpo = JSON.stringify({
      orders: args.orders,
      tenant: args.tenant ?? 0,
    });

    try {
      const response = await fetch(`${this.guardUrl}/v1/guard`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: cuerpo,
      });
      const texto = await response.text();

      if (response.status === 402) {
        return `Payment required for this batch (over the free tier). Pay the challenge with the x402 provider, then retry. Challenge: ${texto}`;
      }
      if (!response.ok) {
        return `Spend guard error ${response.status}: ${texto.slice(0, 300)}`;
      }
      return texto;
    } catch (error: unknown) {
      return `Error calling the spend guard: ${error}`;
    }
  }
  /**
   * The spend guard is chain agnostic: the batch is about the agent's own
   * budgets, not about a network.
   *
   * @returns Always true
   */
  supportsNetwork(): boolean {
    return true;
  }
}

/**
 * Factory function to create a SpendGuardActionProvider.
 *
 * @param guardUrl - Optional base URL of the guard service
 * @returns A new SpendGuardActionProvider instance
 */
export function spendGuardActionProvider(guardUrl?: string): SpendGuardActionProvider {
  return new SpendGuardActionProvider(guardUrl);
}
