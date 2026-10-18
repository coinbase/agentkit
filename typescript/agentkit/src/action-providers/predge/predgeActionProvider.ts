import { z } from "zod";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider, SvmWalletProvider, WalletProvider } from "../../wallet-providers";
import { getX402Networks } from "../x402/utils";
import {
  DEFAULT_MAX_PAYMENT_USD,
  PREDGE_API_URL,
  PREDGE_ATTESTATION_PUBLIC_KEY,
  PREDGE_USDC_ASSETS,
} from "./constants";
import {
  GetSettlementEstimateSchema,
  GetSettlementRiskSchema,
  GetWhaleTradesSchema,
  VerifyRecordSchema,
} from "./schemas";
import { PredgeActionProviderConfig } from "./types";
import { summarizeSettlementRisk, verifyBodySignature, verifyPredgeRecord } from "./utils";

/**
 * PredgeActionProvider gives agents signed settlement-risk records for Polymarket markets
 * (read live from UMA on Polygon), offline verification of Predge records, and paid
 * Predge data over x402.
 *
 * @augments ActionProvider
 */
export class PredgeActionProvider extends ActionProvider<WalletProvider> {
  private readonly baseUrl: string;
  private readonly maxPaymentUsd: number;
  private readonly trustedKeys: string[];

  /**
   * Constructor for the PredgeActionProvider class.
   *
   * @param config - The configuration options for the PredgeActionProvider
   */
  constructor(config: PredgeActionProviderConfig = {}) {
    super("predge", []);
    this.baseUrl = (config.baseUrl ?? PREDGE_API_URL).replace(/\/+$/, "");
    this.maxPaymentUsd = config.maxPaymentUsd ?? DEFAULT_MAX_PAYMENT_USD;
    this.trustedKeys = config.trustedKeys ?? [PREDGE_ATTESTATION_PUBLIC_KEY];
  }

  /**
   * Fetches the free, signed settlement-risk record for a Polymarket market.
   *
   * @param _walletProvider - The wallet provider (unused)
   * @param args - The market to check
   * @returns A JSON string with the risk summary and the signature check
   */
  @CreateAction({
    name: "get_settlement_risk",
    description: `
This tool checks whether a Polymarket market's resolution is settled, disputed or at risk, before the agent trades, pays or settles anything on that market. It is free and needs no API key.

It takes a Polymarket market as input: a condition id (0x...), a numeric market id, or a slug.

It returns a signed record read live from UMA's Optimistic Oracle on Polygon:
- risk_level: one of "ok", "watch", "caution" or "resolved"
- recommendation: a one-line reading of the on-chain facts
- uma_state, dispute_count, open_dispute, sent_to_uma_vote, paused, onchain_resolution
- signature: the result of verifying Predge's ed25519 signature against Predge's published key

Treat "caution" and "watch" as reasons to stop and tell the user before acting. If the record cannot be fetched or the signature does not verify, do not treat that as a "no risk" answer.
Example market inputs: "0x77dcfa8756d12e46b031ac2cacabcc628c17b41de07fcb925c9eafbb14bca28c", "5608010", "fed-rate-cut-september".
`,
    schema: GetSettlementRiskSchema,
  })
  async getSettlementRisk(
    _walletProvider: WalletProvider,
    args: z.infer<typeof GetSettlementRiskSchema>,
  ): Promise<string> {
    const url = `${this.baseUrl}/v1/settlement-risk/${encodeURIComponent(args.market)}`;
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      const text = await response.text();
      const data = this.parseJson(text);
      if (!response.ok) {
        return this.formatApiError(response.status, data, url);
      }
      if (!data) {
        return JSON.stringify({ error: true, message: "Predge returned a non-JSON response", url });
      }
      const verification = verifyPredgeRecord(data, this.trustedKeys);
      const bodySignature = verifyBodySignature(
        text,
        response.headers.get("x-predge-body-signature"),
        this.trustedKeys,
      );
      return JSON.stringify(
        {
          ...summarizeSettlementRisk(data),
          signature: { ...verification, bodySignature },
          source: url,
        },
        null,
        2,
      );
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: `Error fetching Predge settlement risk: ${error instanceof Error ? error.message : String(error)}`,
        url,
      });
    }
  }

  /**
   * Verifies a Predge signed record offline.
   *
   * @param _walletProvider - The wallet provider (unused)
   * @param args - The record to verify, as a JSON string
   * @returns A JSON string with each verification check
   */
  @CreateAction({
    name: "verify_predge_record",
    description: `
This tool verifies a Predge signed record offline, without calling Predge. Use it when a user or another agent hands you a Predge record (settlement risk, attestation, signed call) and you need to know it is genuine and unmodified.

It takes the record as a JSON string: a full Predge API response, or its "attestation" envelope.

It checks the ed25519 signature over the canonical bytes against Predge's pinned public key (never the key inside the record), that the payload rebuilds the canonical string, the content hash, and the envelope signature when present. It returns valid: true only if every check passes.
`,
    schema: VerifyRecordSchema,
  })
  async verifyRecord(
    _walletProvider: WalletProvider,
    args: z.infer<typeof VerifyRecordSchema>,
  ): Promise<string> {
    const parsed = this.parseJson(args.record);
    if (!parsed) {
      return JSON.stringify({ valid: false, error: "Record is not valid JSON" });
    }
    return JSON.stringify(verifyPredgeRecord(parsed, this.trustedKeys), null, 2);
  }

  /**
   * Buys the signed settlement-risk record with settlement_estimate over x402.
   *
   * @param walletProvider - The wallet provider used to pay
   * @param args - The market to check
   * @returns A JSON string with the record summary, settlement_estimate and signature check
   */
  @CreateAction({
    name: "get_settlement_estimate",
    description: `
This tool buys Predge's signed settlement estimate for a Polymarket market. It costs $0.02 in USDC per call, paid automatically over x402 from the agent's wallet (Base or Solana mainnet). Requests that fail (400/404/422/502) are not charged.

It takes a Polymarket market as input: a condition id (0x...), a numeric market id, or a slug.

It returns the same signed record as get_settlement_risk plus settlement_estimate: for a market that has been disputed and is not yet resolved, the calibrated probability that it settles differently from the disputed proposal.
Use get_settlement_risk first; only call this when the market has a dispute and the user wants the estimate.
`,
    schema: GetSettlementEstimateSchema,
  })
  async getSettlementEstimate(
    walletProvider: WalletProvider,
    args: z.infer<typeof GetSettlementEstimateSchema>,
  ): Promise<string> {
    const url = `${this.baseUrl}/v1/settlement-risk/${encodeURIComponent(args.market)}/estimate`;
    return this.paidRequest(walletProvider, url, data => ({
      ...summarizeSettlementRisk(data),
      signature: verifyPredgeRecord(data, this.trustedKeys),
    }));
  }

  /**
   * Buys the latest Polymarket whale trades over x402.
   *
   * @param walletProvider - The wallet provider used to pay
   * @param args - How many trades to return
   * @returns A JSON string with the trades
   */
  @CreateAction({
    name: "get_whale_trades",
    description: `
This tool buys the latest Polymarket whale trades from Predge: trades of $10,000+ notional with market, side, size, price, wallet address and a Predge wallet score. Data is delayed 15 minutes. It costs $0.005 in USDC per call, paid automatically over x402 from the agent's wallet (Base or Solana mainnet).

It takes an optional limit (1-100, default 20).
`,
    schema: GetWhaleTradesSchema,
  })
  async getWhaleTrades(
    walletProvider: WalletProvider,
    args: z.infer<typeof GetWhaleTradesSchema>,
  ): Promise<string> {
    const url = `${this.baseUrl}/v1/whales/latest?limit=${args.limit ?? 20}`;
    return this.paidRequest(walletProvider, url, data => data);
  }

  /**
   * Checks if the action provider supports the given network.
   * The free actions work on any network; paid actions check the wallet at call time.
   *
   * @param _ - The network to check
   * @returns Always true
   */
  supportsNetwork(_: Network): boolean {
    return true;
  }

  /**
   * Makes a paid x402 request, paying only in USDC on the wallet's own network and only up to
   * the configured maximum.
   *
   * @param walletProvider - The wallet provider used to pay
   * @param url - The paid Predge URL
   * @param shape - Maps the parsed response to the returned result
   * @returns A JSON string with the result or error
   */
  private async paidRequest(
    walletProvider: WalletProvider,
    url: string,
    shape: (data: Record<string, unknown>) => unknown,
  ): Promise<string> {
    if (this.maxPaymentUsd <= 0) {
      return JSON.stringify({
        error: true,
        message: "Paid Predge actions are disabled (maxPaymentUsd is 0)",
      });
    }
    if (
      !(walletProvider instanceof EvmWalletProvider || walletProvider instanceof SvmWalletProvider)
    ) {
      return JSON.stringify({
        error: true,
        message: "Paid Predge actions need an EVM or Solana wallet provider",
      });
    }
    const networks = getX402Networks(walletProvider.getNetwork()).filter(
      n => PREDGE_USDC_ASSETS[n],
    );
    if (networks.length === 0) {
      return JSON.stringify({
        error: true,
        message: `Predge accepts USDC on Base or Solana mainnet; the wallet is on ${walletProvider.getNetwork().networkId}`,
      });
    }
    const maxAtomic = BigInt(Math.floor(this.maxPaymentUsd * 1_000_000));

    try {
      const client = await this.createX402Client(walletProvider);
      client.registerPolicy((_version, requirements) =>
        requirements.filter(
          r =>
            networks.includes(r.network) &&
            r.asset.toLowerCase() === PREDGE_USDC_ASSETS[r.network].toLowerCase() &&
            BigInt(r.amount) <= maxAtomic,
        ),
      );
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);
      const response = await fetchWithPayment(url, { headers: { Accept: "application/json" } });
      const text = await response.text();
      const data = this.parseJson(text);
      if (!response.ok) {
        return this.formatApiError(response.status, data, url);
      }
      if (!data) {
        return JSON.stringify({ error: true, message: "Predge returned a non-JSON response", url });
      }
      const paymentHeader =
        response.headers.get("payment-response") ?? response.headers.get("x-payment-response");
      let payment: unknown = null;
      if (paymentHeader) {
        try {
          payment = JSON.parse(atob(paymentHeader));
        } catch {
          payment = { raw: paymentHeader };
        }
      }
      return JSON.stringify({ ...(shape(data) as object), payment, source: url }, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: true,
        message: `Error calling paid Predge route (no payment above $${this.maxPaymentUsd} is made): ${error instanceof Error ? error.message : String(error)}`,
        url,
      });
    }
  }

  /**
   * Creates an x402 client that signs with the agent's wallet.
   *
   * @param walletProvider - The wallet provider
   * @returns The x402 client
   */
  private async createX402Client(
    walletProvider: EvmWalletProvider | SvmWalletProvider,
  ): Promise<x402Client> {
    const client = new x402Client();
    if (walletProvider instanceof EvmWalletProvider) {
      const account = walletProvider.toSigner();
      const signer = {
        ...account,
        readContract: (args: {
          address: `0x${string}`;
          abi: readonly unknown[];
          functionName: string;
          args?: readonly unknown[];
        }) =>
          walletProvider.readContract({
            address: args.address,
            abi: args.abi as never,
            functionName: args.functionName as never,
            args: args.args as never,
          }),
      };
      registerExactEvmScheme(client, { signer });
    } else {
      registerExactSvmScheme(client, { signer: await walletProvider.toSigner() });
    }
    return client;
  }

  /**
   * Parses JSON, returning null on failure.
   *
   * @param text - The text to parse
   * @returns The parsed object or null
   */
  private parseJson(text: string): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  /**
   * Formats a Predge API error.
   *
   * @param status - HTTP status
   * @param data - Parsed body, if any
   * @param url - Request URL
   * @returns A JSON error string
   */
  private formatApiError(
    status: number,
    data: Record<string, unknown> | null,
    url: string,
  ): string {
    return JSON.stringify({
      error: true,
      status,
      code: data?.error,
      message:
        (data?.message as string | undefined) ?? `Predge API request failed with status ${status}`,
      note: "An error is not a 'no risk' answer.",
      url,
    });
  }
}

/**
 * Factory function to create a new PredgeActionProvider instance.
 *
 * @param config - The configuration options for the PredgeActionProvider
 * @returns A new instance of PredgeActionProvider
 */
export const predgeActionProvider = (config: PredgeActionProviderConfig = {}) =>
  new PredgeActionProvider(config);
