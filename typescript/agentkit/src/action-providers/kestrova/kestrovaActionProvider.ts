import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider, SvmWalletProvider, WalletProvider } from "../../wallet-providers";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import type { PaymentRequirements } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import {
  KestrovaConfig,
  KestrovaPaidScanSchema,
  KestrovaPreviewSchema,
  KestrovaPriceSchema,
} from "./schemas";
import {
  KESTROVA_DEFAULT_BASE_URL,
  KESTROVA_PAYMENT_TERMS,
  KESTROVA_SOURCE_TAG,
  KESTROVA_TIERS,
  KestrovaTier,
} from "./constants";

type PinnedTerms = { network: string; asset: string; payTo: string };

/**
 * Amount of a payment requirement in atomic units (x402 v2 `amount`, v1 `maxAmountRequired`).
 *
 * @param requirement - A payment requirement from a 402 response
 * @returns The amount as a string, or undefined
 */
function amountOf(requirement: Record<string, unknown>): string | undefined {
  const value = requirement.amount ?? requirement.maxAmountRequired;
  return value === undefined || value === null ? undefined : String(value);
}

/**
 * True only for the exact terms Kestrova publishes for this tier and network.
 *
 * @param requirement - A payment requirement from a 402 response
 * @param pinned - The pinned network, asset and recipient
 * @param amount - The tier price in atomic units
 * @returns Whether the requirement may be paid
 */
export function matchesPinnedTerms(
  requirement: Record<string, unknown>,
  pinned: PinnedTerms,
  amount: string,
): boolean {
  const asset = String(requirement.asset ?? "");
  const payTo = String(requirement.payTo ?? "");
  const evm = pinned.network.startsWith("eip155:");
  return (
    requirement.scheme === "exact" &&
    requirement.network === pinned.network &&
    (evm ? asset.toLowerCase() === pinned.asset.toLowerCase() : asset === pinned.asset) &&
    (evm ? payTo.toLowerCase() === pinned.payTo.toLowerCase() : payTo === pinned.payTo) &&
    amountOf(requirement) === amount
  );
}

/**
 * KestrovaActionProvider: Solidity security scanning (Slither static analysis) for agents that write or deploy
 * contracts. The preview is free; full results are paid per call with x402 in USDC on Base or Solana mainnet.
 */
export class KestrovaActionProvider extends ActionProvider<WalletProvider> {
  private readonly baseUrl: string;
  private readonly maxPaymentUsdc: number;

  /**
   * Creates a new KestrovaActionProvider.
   *
   * @param config - Optional base URL and per-call payment cap
   */
  constructor(config: KestrovaConfig = {}) {
    super("kestrova", []);
    this.baseUrl = (config.baseUrl ?? KESTROVA_DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.maxPaymentUsdc =
      config.maxPaymentUsdc ?? parseFloat(process.env.KESTROVA_MAX_PAYMENT_USDC ?? "1.0");
  }

  /**
   * Free preview: severity counts, High/Medium detector names and one example finding.
   *
   * @param _walletProvider - Unused (the preview needs no wallet)
   * @param args - The Solidity sources
   * @returns The preview as a JSON string
   */
  @CreateAction({
    name: "kestrova_scan_preview",
    description: `Free Solidity security check with Kestrova (Slither static analysis). No wallet, no payment.
Use it after writing or changing a Solidity contract and before deploying it.

Input: sources, a map of file path to Solidity source; include every file the contract imports
(OpenZeppelin 5 imports are supplied by the service). Limit: about 15 KB / 10 files, a few calls per hour.

Returns severity counts, the names of High/Medium detectors, one example finding and "behind_paywall",
which says exactly what a paid result would add. Automated analysis, not an audit: zero findings does not
mean the contract is safe.`,
    schema: KestrovaPreviewSchema,
  })
  async scanPreview(
    _walletProvider: WalletProvider,
    args: z.infer<typeof KestrovaPreviewSchema>,
  ): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/preview?src=${KESTROVA_SOURCE_TAG}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ sources: args.sources }),
      });
      const data = await this.readBody(response);
      if (!response.ok) {
        return JSON.stringify({ error: true, status: response.status, data }, null, 2);
      }
      return JSON.stringify(data, null, 2);
    } catch (error) {
      return JSON.stringify({ error: true, message: `Kestrova preview failed: ${error}` }, null, 2);
    }
  }

  /**
   * Reads the live payment terms of a paid tier for the wallet's network, without paying.
   *
   * @param walletProvider - The wallet provider (its network selects the payment option)
   * @param args - The tier
   * @returns The terms as a JSON string
   */
  @CreateAction({
    name: "kestrova_get_scan_price",
    description: `Show the price of a paid Kestrova scan before buying it. Free; nothing is scanned or paid.
Tiers: "findings" (0.25 USDC: every finding with file and line) and "full" (1 USDC: adds an explanation
and fix per finding, plus PDF and SARIF report files). Payment is USDC via x402 on Base or Solana mainnet.
Show the result to the user and ask for approval before calling kestrova_buy_scan.`,
    schema: KestrovaPriceSchema,
  })
  async getScanPrice(
    walletProvider: WalletProvider,
    args: z.infer<typeof KestrovaPriceSchema>,
  ): Promise<string> {
    const tier = KESTROVA_TIERS[args.tier as KestrovaTier];
    const pinned = KESTROVA_PAYMENT_TERMS[walletProvider.getNetwork().networkId ?? ""];
    try {
      const response = await fetch(`${this.baseUrl}${tier.path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ sources: {} }),
      });
      const accepts = this.decodeAccepts(response.headers.get("payment-required"));
      const option = pinned
        ? accepts.find(a => matchesPinnedTerms(a, pinned, tier.amount))
        : undefined;
      return JSON.stringify(
        {
          tier: args.tier,
          priceUsdc: Number(tier.amount) / 1e6,
          includes: tier.description,
          walletNetwork: walletProvider.getNetwork().networkId,
          payable: Boolean(option) && Number(tier.amount) / 1e6 <= this.maxPaymentUsdc,
          paymentOption: option ?? null,
          maxPaymentUsdc: this.maxPaymentUsdc,
          note: pinned
            ? option
              ? "Charged only if the scan succeeds. Ask the user to approve this price before buying."
              : "The live terms did not match Kestrova's published terms for this network; do not pay."
            : "Paid scans need a wallet on base-mainnet or solana-mainnet.",
        },
        null,
        2,
      );
    } catch (error) {
      return JSON.stringify(
        { error: true, message: `Could not read Kestrova terms: ${error}` },
        null,
        2,
      );
    }
  }

  /**
   * Buys one paid scan with x402. Only exactly Kestrova's published terms can be signed.
   *
   * @param walletProvider - The paying wallet (EVM on Base mainnet or SVM on Solana mainnet)
   * @param args - The Solidity sources and the tier
   * @returns The scan result, or the reason nothing was paid, as a JSON string
   */
  @CreateAction({
    name: "kestrova_buy_scan",
    description: `PAID. Buy one Kestrova Solidity scan with x402 (USDC on Base or Solana mainnet).
Only call this after the user has approved the price shown by kestrova_get_scan_price.

Tiers: "findings" (0.25 USDC: every finding with detector, severity, file and line, as JSON) and
"full" (1 USDC: adds a plain-English explanation and fix for each finding, plus PDF/SARIF report files).
The wallet signs only Kestrova's exact published terms (amount, USDC, recipient, network) and never more
than the configured maxPaymentUsdc. Charged only if the scan succeeds.

If the result says the outcome is pending or already paid, DO NOT pay again: the paid report can be
recovered for free with a wallet signature at POST /scan/recover on the same service.`,
    schema: KestrovaPaidScanSchema,
  })
  async buyScan(
    walletProvider: WalletProvider,
    args: z.infer<typeof KestrovaPaidScanSchema>,
  ): Promise<string> {
    const tier = KESTROVA_TIERS[args.tier as KestrovaTier];
    const networkId = walletProvider.getNetwork().networkId ?? "";
    const pinned = KESTROVA_PAYMENT_TERMS[networkId];
    const priceUsdc = Number(tier.amount) / 1e6;
    if (!pinned) {
      return this.refuse(
        `Paid scans need a wallet on base-mainnet or solana-mainnet (got "${networkId}").`,
      );
    }
    if (
      !(walletProvider instanceof EvmWalletProvider || walletProvider instanceof SvmWalletProvider)
    ) {
      return this.refuse("Only EVM and SVM wallet providers can pay with x402.");
    }
    if (priceUsdc > this.maxPaymentUsdc) {
      return this.refuse(
        `The ${args.tier} tier costs ${priceUsdc} USDC, above maxPaymentUsdc (${this.maxPaymentUsdc}).`,
      );
    }

    const url = `${this.baseUrl}${tier.path}?src=${KESTROVA_SOURCE_TAG}`;
    let paymentStarted = false;
    try {
      const client = await this.createClient(walletProvider);
      // The policy runs on the 402 the payment is built from: only Kestrova's exact terms survive.
      client.registerPolicy((_version: number, requirements: PaymentRequirements[]) =>
        requirements.filter(r =>
          matchesPinnedTerms(r as unknown as Record<string, unknown>, pinned, tier.amount),
        ),
      );
      client.onBeforePaymentCreation(async () => {
        paymentStarted = true;
      });
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);
      const response = await fetchWithPayment(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ sources: args.sources }),
      });
      const data = await this.readBody(response);
      const receipt = response.headers.get("payment-response");

      if (response.status === 200) {
        return JSON.stringify(
          {
            success: true,
            tier: args.tier,
            priceUsdc,
            result: data,
            paymentResponse: receipt ? this.decodeHeader(receipt) : null,
            reportToken: response.headers.get("x-kestrova-report-token") ?? undefined,
          },
          null,
          2,
        );
      }
      if (response.status === 402 && !paymentStarted) {
        return this.refuse(
          "Kestrova's live payment terms did not match its published terms, so nothing was signed or paid.",
          data,
        );
      }
      return JSON.stringify(
        {
          success: false,
          status: response.status,
          data,
          doNotPayAgain: paymentStarted,
          recovery: paymentStarted
            ? `${this.baseUrl}/scan/recover (wallet-signed challenge; never a second payment)`
            : undefined,
        },
        null,
        2,
      );
    } catch (error) {
      return JSON.stringify(
        {
          success: false,
          message: `Kestrova paid scan failed: ${error}`,
          doNotPayAgain: paymentStarted,
          recovery: paymentStarted ? `${this.baseUrl}/scan/recover` : undefined,
        },
        null,
        2,
      );
    }
  }

  /**
   * The preview works on any network; paid actions check the wallet's network themselves.
   *
   * @returns Always true
   */
  supportsNetwork = () => true;

  /**
   * Creates an x402 client for the wallet.
   *
   * @param walletProvider - An EVM or SVM wallet provider
   * @returns The x402 client
   */
  private async createClient(
    walletProvider: EvmWalletProvider | SvmWalletProvider,
  ): Promise<x402Client> {
    const client = new x402Client();
    if (walletProvider instanceof EvmWalletProvider) {
      const account = walletProvider.toSigner();
      const signer = {
        ...account,
        readContract: (a: {
          address: `0x${string}`;
          abi: readonly unknown[];
          functionName: string;
          args?: readonly unknown[];
        }) =>
          walletProvider.readContract({
            address: a.address,
            abi: a.abi as never,
            functionName: a.functionName as never,
            args: a.args as never,
          }),
      };
      registerExactEvmScheme(client, { signer });
    } else {
      registerExactSvmScheme(client, { signer: await walletProvider.toSigner() });
    }
    return client;
  }

  /**
   * Decodes the base64 JSON `PAYMENT-REQUIRED` header into its `accepts` list.
   *
   * @param header - The header value
   * @returns The payment requirements (empty when absent or invalid)
   */
  private decodeAccepts(header: string | null): Record<string, unknown>[] {
    const decoded = header ? this.decodeHeader(header) : null;
    const accepts = (decoded as { accepts?: unknown } | null)?.accepts;
    return Array.isArray(accepts) ? (accepts as Record<string, unknown>[]) : [];
  }

  /**
   * Decodes a base64 JSON header.
   *
   * @param header - The header value
   * @returns The decoded object, or the raw value when it is not base64 JSON
   */
  private decodeHeader(header: string): unknown {
    try {
      return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    } catch {
      return { raw: header };
    }
  }

  /**
   * Reads a response body as JSON when possible, else text.
   *
   * @param response - The fetch response
   * @returns The body
   */
  private async readBody(response: Response): Promise<unknown> {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  /**
   * A refusal where nothing was signed or paid.
   *
   * @param message - Why the payment was refused
   * @param data - Optional response data
   * @returns The refusal as a JSON string
   */
  private refuse(message: string, data?: unknown): string {
    return JSON.stringify({ success: false, paid: false, message, data }, null, 2);
  }
}

export const kestrovaActionProvider = (config: KestrovaConfig = {}) =>
  new KestrovaActionProvider(config);
