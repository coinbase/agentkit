import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { CheckBotSchema, CheckPaymentSchema, ReportDeliverySchema } from "./schemas";
import { KEPTVOW_BASE_URL, KEPTVOW_TIMEOUT_MS } from "./constants";
import {
  KeptvowActionProviderConfig,
  KeptvowCheckResponse,
  KeptvowReportResponse,
  KeptvowTrustResponse,
} from "./types";

/**
 * KeptvowActionProvider is an action provider for Keptvow (keptvow.com), which reads public
 * payment history and answers whether a seller wallet or a bot is worth paying: ok, careful or stop.
 * It only reads: it never holds money, keys or wallets, and works on every network.
 *
 * @augments ActionProvider
 */
export class KeptvowActionProvider extends ActionProvider {
  private readonly apiKey?: string;

  /**
   * Constructor for the KeptvowActionProvider class.
   *
   * @param config - The configuration options for the KeptvowActionProvider
   */
  constructor(config: KeptvowActionProviderConfig = {}) {
    super("keptvow", []);

    this.apiKey = config.apiKey || process.env.KEPTVOW_API_KEY;
  }

  /**
   * Checks a wallet before paying it.
   *
   * @param args - The wallet to check and, optionally, the amount about to be paid
   * @returns A JSON string with the verdict (ok, careful or stop) and the reason, or an error message
   */
  @CreateAction({
    name: "check_payment",
    description: `This tool will check a seller's wallet on Keptvow BEFORE paying it, and say whether to pay.
It takes the following inputs:
- The wallet address about to be paid (for example the payTo of an x402 payment request): a 0x address or a Solana address
- Optionally, the amount about to be paid in US dollars

Important notes:
- Call this before sending a payment to a wallet you have not paid before
- Returns a verdict: "ok" (a real record of buyers who came back), "careful" (little or no record: pay only what you can afford to lose) or "stop" (do not pay)
- Returns the reason in plain words and a link to the wallet's page
- The wallet is also checked against the US sanctions list (OFAC)
- After you pay, call report_delivery to say whether the result arrived
- It only reads public records: it never moves money`,
    schema: CheckPaymentSchema,
  })
  async checkPayment(args: z.infer<typeof CheckPaymentSchema>): Promise<string> {
    try {
      const query = new URLSearchParams({ pay_to: args.payTo.trim() });
      if (args.amountUsd != null) {
        query.set("amount_usd", String(args.amountUsd));
      }
      const { ok, status, data } = await this.request<KeptvowCheckResponse>(`/v1/check?${query}`);
      if (!ok) {
        return `Error checking payment: ${data.error ?? `HTTP ${status}`}`;
      }

      return JSON.stringify(
        {
          verdict: data.verdict,
          advice: data.advice,
          payTo: data.pay_to ?? args.payTo,
          ...(data.sanctions_list ? { sanctionsList: data.sanctions_list } : {}),
          details: data.wallet_page ? new URL(data.wallet_page, KEPTVOW_BASE_URL).href : undefined,
        },
        null,
        2,
      );
    } catch (error: unknown) {
      return `Error checking payment: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Looks up a bot's record.
   *
   * @param args - The bot to look up
   * @returns A JSON string with the bot's trust level, score and reasons, or an error message
   */
  @CreateAction({
    name: "check_bot",
    description: `This tool will look up a bot's public record on Keptvow before dealing with it.
It takes the following inputs:
- The bot to look up: an ERC-8004 registry id such as "erc8004:8453:1234" (chain id and bot number), or a Keptvow agent id

Important notes:
- Returns a trust level (excellent, good, fair, caution or unknown), a score and the reasons behind them
- "unknown" means Keptvow has no record yet, not that the bot is bad: start small
- It only reads public records: it never moves money`,
    schema: CheckBotSchema,
  })
  async checkBot(args: z.infer<typeof CheckBotSchema>): Promise<string> {
    try {
      const { ok, status, data } = await this.request<KeptvowTrustResponse>(
        `/v1/trust/${encodeURIComponent(args.agentId.trim())}`,
      );
      if (!ok) {
        return `Error checking bot: ${data.error ?? `HTTP ${status}`}`;
      }

      return JSON.stringify(
        {
          agentId: data.agent_id ?? args.agentId,
          trustLevel: data.trust_level,
          score: data.score,
          reasons: (data.reasons ?? []).slice(0, 5),
        },
        null,
        2,
      );
    } catch (error: unknown) {
      return `Error checking bot: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Tells Keptvow whether a payment delivered what was paid for.
   *
   * @param args - The payment's transaction hash, whether it delivered, and optionally the seller wallet
   * @returns A JSON string saying the report was queued, or an error message
   */
  @CreateAction({
    name: "report_delivery",
    description: `This tool will tell Keptvow whether a payment you made delivered what you paid for.
It takes the following inputs:
- The transaction hash of the payment (0x followed by 64 hex characters, from the PAYMENT-RESPONSE header)
- Whether the paid request delivered: true if you got what you paid for, false if you paid and got nothing or a broken answer
- Optionally, the seller wallet you paid

Important notes:
- Call this after paying a seller, whether it went well or not
- Keptvow checks the payment on Base within a minute: only a buyer who really paid that seller counts, once per payment
- Honest sellers earn trust from reports that it arrived, and sellers that take the money and deliver nothing are flagged
- It never moves money`,
    schema: ReportDeliverySchema,
  })
  async reportDelivery(args: z.infer<typeof ReportDeliverySchema>): Promise<string> {
    try {
      const { ok, status, data } = await this.request<KeptvowReportResponse>("/v1/outcomes", {
        tx: args.tx.trim(),
        delivered: args.delivered,
        ...(args.payTo ? { pay_to: args.payTo.trim() } : {}),
      });
      if (!ok) {
        return `Error reporting delivery: ${data.error ?? `HTTP ${status}`}`;
      }

      return JSON.stringify({ status: data.status, note: data.note }, null, 2);
    } catch (error: unknown) {
      return `Error reporting delivery: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Checks if the Keptvow action provider supports the given network.
   * Keptvow reads public records and is network-agnostic, so this always returns true.
   *
   * @returns True, as Keptvow actions are supported on all networks.
   */
  supportsNetwork(): boolean {
    return true;
  }

  /**
   * Makes a request to the Keptvow API: a GET, or a POST when given a body. (Not named `get`: the
   * action decorator hands the class prototype back to TypeScript, which would read a method
   * called `get` as a property getter.)
   *
   * @param path - The path and query string to request
   * @param body - Optional JSON body: when given, the request is a POST
   * @returns Whether the request succeeded, its HTTP status and its parsed JSON body
   */
  private async request<T extends { error?: string }>(
    path: string,
    body?: Record<string, unknown>,
  ): Promise<{ ok: boolean; status: number; data: T }> {
    const response = await fetch(`${KEPTVOW_BASE_URL}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(this.apiKey ? { "X-Api-Key": this.apiKey } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(KEPTVOW_TIMEOUT_MS),
    });
    const data = ((await response.json().catch(() => ({}))) ?? {}) as T;
    return { ok: response.ok, status: response.status, data };
  }
}

/**
 * Creates a new instance of the Keptvow action provider.
 *
 * @param config - The configuration options for the Keptvow action provider
 * @returns A new KeptvowActionProvider instance
 */
export const keptvowActionProvider = (config: KeptvowActionProviderConfig = {}) =>
  new KeptvowActionProvider(config);
