import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { PreflightPaymentSchema, SpendPreflightConfig } from "./schemas";
import { createPreflightReviewer } from "./preflight";

/** Informational preflight action; never obtains a signer or executes a payment. */
export class SpendPreflightActionProvider extends ActionProvider {
  private readonly review: ReturnType<typeof createPreflightReviewer>;

  /**
   * Constructs an offline provider unless an application supplies a screening client.
   *
   * @param config - Operator-owned transport and rules, separate from model inputs.
   */
  constructor(config: SpendPreflightConfig = {}) {
    super("spendpreflight", []);
    this.review = createPreflightReviewer(config);
  }

  /**
   * Reviews a supplied challenge without calling or paying its merchant.
   *
   * @param args - The challenge and its HTTPS resource URL.
   * @returns JSON containing an informational decision, reasons and any receipt.
   */
  @CreateAction({
    name: "preflight_payment",
    description: `Operated by SpendPreflight, our paid API. Reviews an x402 challenge before payment.
Inputs: challenge and resource_url. Example resource_url: https://merchant.example/data.
Default is offline hold with no signer. Live screening requires an explicitly configured client and costs $0.02 in Base USDC, separate from merchant payment.
Returns allow, hold or block with reasons and any receipt. Unavailable screening holds. This action never signs or pays the merchant and is not an automatic payment gate.
The application must verify the receipt, bind the selected terms, enforce budgets and stop on hold/block before any signing. Informational screening, not a safety or compliance certification.`,
    schema: PreflightPaymentSchema,
  })
  async preflightPayment(args: z.infer<typeof PreflightPaymentSchema>): Promise<string> {
    return JSON.stringify(await this.review(args));
  }

  /**
   * Indicates that the reviewer does not depend on the agent wallet's network.
   *
   * @param _network - Unused wallet network; the API may still reject unsupported terms.
   * @returns True; no wallet or network capability is exercised by this provider.
   */
  supportsNetwork(_network: Network): boolean {
    return true;
  }
}

/**
 * Creates the single preflight action with offline defaults.
 *
 * @param config - Explicit application configuration.
 * @returns A preflight-only provider.
 */
export const spendpreflightActionProvider = (config: SpendPreflightConfig = {}) =>
  new SpendPreflightActionProvider(config);
