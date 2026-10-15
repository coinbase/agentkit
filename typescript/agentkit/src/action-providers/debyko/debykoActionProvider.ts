import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import { HistorySchema, ScreenSchema, SnapshotsSchema } from "./schemas";
import { API_ROOT, DEFAULT_MAX_PAYMENT_USDC, decideOffers, paidFetch } from "./payment";

/**
 * Configuration for the DEBYKO action provider.
 */
export interface DebykoConfig {
  /** Per-call cap in USDC whole units. Default 0.05. Checked before any signature. */
  maxPaymentUsdc?: number;
  /**
   * When set, every request sends Authorization: Bearer and does not enter x402.
   * A failed response is returned as DEBYKO wrote it. It is not retried as a payment.
   */
  apiKey?: string;
}

const STALE =
  "Each value carries its venue, its age and its status. A stale value is withheld: it is not returned as the number.";

/**
 * Typed DEBYKO actions.
 *
 * Discovery, calling and paying already work through AgentKit's x402 provider and the Agentic Market
 * listing. These actions add DEBYKO descriptions, DQL guidance on screen, error and hint passthrough,
 * an optional Bearer key that never falls back to x402, and a per-call cap checked before signing.
 */
export class DebykoActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly apiKey?: string;
  private readonly maxPaymentUsdc: number;

  /**
   * Constructor for the DebykoActionProvider.
   *
   * @param config - Optional API key and per-call USDC cap.
   */
  constructor(config: DebykoConfig = {}) {
    super("debyko", []);
    this.apiKey = config.apiKey;
    this.maxPaymentUsdc = config.maxPaymentUsdc ?? DEFAULT_MAX_PAYMENT_USDC;
  }

  /**
   * Reads current snapshot layers from DEBYKO.
   *
   * @param wallet - The wallet that signs an x402 payment when no API key is set.
   * @param args - The snapshot request.
   * @returns The DEBYKO response body.
   */
  @CreateAction({
    name: "debyko_snapshots",
    description: `Read current snapshot layers from DEBYKO, POST /v2/snapshots. The price is 0.005 USDC per call when paying with x402 on Base. ${STALE}`,
    schema: SnapshotsSchema,
  })
  async snapshots(
    wallet: EvmWalletProvider,
    args: z.infer<typeof SnapshotsSchema>,
  ): Promise<string> {
    return this.post("/v2/snapshots", args, wallet);
  }

  /**
   * Runs one DQL query on DEBYKO.
   *
   * @param wallet - The wallet that signs an x402 payment when no API key is set.
   * @param args - The screen request. The query is DQL, and names come from the catalogue.
   * @returns The DEBYKO response body.
   */
  @CreateAction({
    name: "debyko_screen",
    description: `Run one DQL query on DEBYKO, POST /v2/screen. The query is DQL only. Names come from the catalogue. The guide is https://docs.debyko.com/dql/guide/ . The price is 0.01 USDC per call when paying with x402 on Base. ${STALE}`,
    schema: ScreenSchema,
  })
  async screen(wallet: EvmWalletProvider, args: z.infer<typeof ScreenSchema>): Promise<string> {
    return this.post("/v2/screen", args, wallet);
  }

  /**
   * Reads past snapshots from DEBYKO.
   *
   * @param wallet - The wallet that signs an x402 payment when no API key is set.
   * @param args - The history request. Send exactly one of interval, at, or raw: true.
   * @returns The DEBYKO response body.
   */
  @CreateAction({
    name: "debyko_history",
    description: `Read past snapshots from DEBYKO, POST /v2/snapshots/history. Send exactly one of interval, at, or raw: true. from and to are required with interval and with raw, and refused with at. The price is 0.02 USDC per call when paying with x402 on Base. ${STALE}`,
    schema: HistorySchema,
  })
  async history(wallet: EvmWalletProvider, args: z.infer<typeof HistorySchema>): Promise<string> {
    return this.post("/v2/snapshots/history", args, wallet);
  }

  /**
   * Checks whether this provider can run on the wallet's network.
   *
   * A key needs no chain. A payment is signed only on Base mainnet.
   *
   * @param network - The wallet network.
   * @returns True when the provider can run.
   */
  supportsNetwork = (network: Network): boolean => {
    if (this.apiKey) return true;
    return network.protocolFamily === "evm" && network.networkId === "base-mainnet";
  };

  /**
   * Posts one request, with a Bearer key or with an x402 payment under the cap.
   *
   * @param path - The API path, beginning with /v2.
   * @param payload - The JSON body.
   * @param wallet - The wallet that signs an x402 payment when no API key is set.
   * @returns The response body, or a refusal when the payment is not acceptable.
   */
  private async post(path: string, payload: unknown, wallet: EvmWalletProvider): Promise<string> {
    const url = `${API_ROOT}${path}`;
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
    };

    if (this.apiKey) {
      headers.authorization = `Bearer ${this.apiKey}`;
      const response = await fetch(url, { method: "POST", headers, body });
      return response.text();
    }

    const probe = await fetch(url, { method: "POST", headers, body });
    if (probe.status !== 402) return answer(probe);

    const decision = decideOffers(probe.headers.get("payment-required"), this.maxPaymentUsdc);
    if (!decision.ok) return decision.reason;

    let replayed = false;
    const replay: typeof fetch = async (input, init) => {
      if (!replayed) {
        replayed = true;
        return decision.response;
      }
      return fetch(input, init);
    };

    try {
      const response = await paidFetch(
        wallet,
        replay,
        this.maxPaymentUsdc,
      )(url, { method: "POST", headers, body });
      return answer(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : "the payment could not be made";
      return `Payment was not completed: ${message}`;
    }
  }
}

export const debykoActionProvider = (config?: DebykoConfig) => new DebykoActionProvider(config);

/**
 * Returns the body DEBYKO wrote.
 *
 * A non-success body keeps code, message and hint. A success usually has no settlement header,
 * because the 200 is served before the payment settles, and no transaction hash is invented.
 * When PAYMENT-RESPONSE is present it is parsed the way the x402 provider parses it.
 *
 * @param response - The HTTP response.
 * @returns The response text, or the JSON plus a parsed settlement header when one is present.
 */
async function answer(response: Response): Promise<string> {
  const text = await response.text();
  if (!response.ok) return text;
  const settlement =
    response.headers.get("payment-response") ?? response.headers.get("x-payment-response");
  if (!settlement) return text;
  let paymentResponse: unknown;
  try {
    paymentResponse = JSON.parse(atob(settlement));
  } catch {
    paymentResponse = { raw: settlement };
  }
  let result: unknown = text;
  try {
    result = JSON.parse(text);
  } catch {
    result = text;
  }
  return JSON.stringify({ result, paymentResponse });
}
