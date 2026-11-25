import { z } from "zod";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import { createEvmX402Signer, handleHttpError } from "../x402/utils";
import {
  COUNTERPARTY_CHECK_PATH,
  MERCHANT_CHECK_PATH,
  NEUTRAL_FACTS_DISCLAIMER,
  SCREEN_CRYPTO_ADDRESS_PATH,
  STABLECOIN_GATEWAYS_DEFAULT_BASE_URL,
  STABLECOIN_GATEWAYS_DEFAULT_MAX_PAYMENT_USDC,
} from "./constants";
import {
  CounterpartyCheckSchema,
  MerchantCheckSchema,
  ScreenCryptoAddressSchema,
  type StablecoinGatewaysConfig,
} from "./schemas";
import {
  buildGatewayUrl,
  jsonError,
  paymentTxHashFromResponse,
  readQuotedPayments,
  readResponseBody,
  selectUsdcPayment,
} from "./utils";

const PAYMENT_NOTE =
  "Pays the endpoint's x402 v2 quote in USDC on Base from this wallet, up to the configured per-call cap. No API key.";

/**
 * StablecoinGatewaysActionProvider pays for pre-payment compliance lookups.
 *
 * Each action GETs a pay-per-call x402 v2 endpoint on api.stablecoingateways.com and,
 * when the quote is USDC on the wallet's Base network and within the per-call cap,
 * pays with the agent's own wallet. Quotes above the cap, or quotes with no USDC
 * option on that network, are refused before the wallet signs.
 */
export class StablecoinGatewaysActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly baseUrl: string;
  private readonly maxPaymentUsdc: number;

  /**
   * Creates a provider that pays Stablecoin Gateways from an EVM wallet.
   *
   * @param config - Optional API origin and per-call USDC cap.
   */
  constructor(config: StablecoinGatewaysConfig = {}) {
    super("stablecoin_gateways", []);

    const baseUrl = config.baseUrl ?? STABLECOIN_GATEWAYS_DEFAULT_BASE_URL;
    let parsed: URL;
    try {
      parsed = new URL(baseUrl);
    } catch {
      throw new Error(`baseUrl must be an absolute http(s) URL. Received "${baseUrl}".`);
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error(`baseUrl must use http or https. Received "${baseUrl}".`);
    }

    const maxPaymentUsdc = config.maxPaymentUsdc ?? STABLECOIN_GATEWAYS_DEFAULT_MAX_PAYMENT_USDC;
    if (!Number.isFinite(maxPaymentUsdc) || maxPaymentUsdc < 0) {
      throw new Error("maxPaymentUsdc must be a non-negative finite number of USDC.");
    }

    this.baseUrl = baseUrl;
    this.maxPaymentUsdc = maxPaymentUsdc;
  }

  /**
   * Checks a wallet address against OFAC's published digital-currency-address list.
   *
   * @param walletProvider - The wallet that pays the x402 quote.
   * @param args - The address to screen.
   * @returns JSON with the API body and the USDC payment transaction hash.
   */
  @CreateAction({
    name: "screen_crypto_address",
    description: [
      "Check whether a wallet address is on OFAC's list of sanctioned digital currency addresses before sending funds.",
      NEUTRAL_FACTS_DISCLAIMER,
      PAYMENT_NOTE,
    ].join(" "),
    schema: ScreenCryptoAddressSchema,
  })
  async screenCryptoAddress(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ScreenCryptoAddressSchema>,
  ): Promise<string> {
    return this.paidGet(walletProvider, SCREEN_CRYPTO_ADDRESS_PATH, { address: args.address });
  }

  /**
   * Runs a one-call KYB preflight on a business counterparty.
   *
   * @param walletProvider - The wallet that pays the x402 quote.
   * @param args - Name, domain, LEI, VAT, country, and/or wallet address.
   * @returns JSON with the API body and the USDC payment transaction hash.
   */
  @CreateAction({
    name: "counterparty_check",
    description: [
      "KYB preflight facts on a business counterparty before paying it. Provide at least one of name, domain, LEI, or wallet address.",
      NEUTRAL_FACTS_DISCLAIMER,
      PAYMENT_NOTE,
    ].join(" "),
    schema: CounterpartyCheckSchema,
  })
  async counterpartyCheck(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof CounterpartyCheckSchema>,
  ): Promise<string> {
    return this.paidGet(walletProvider, COUNTERPARTY_CHECK_PATH, {
      name: args.name,
      domain: args.domain,
      lei: args.lei,
      vat: args.vat,
      country: args.country,
      address: args.address,
    });
  }

  /**
   * Fetches neutral facts about a merchant before paying it.
   *
   * @param walletProvider - The wallet that pays the x402 quote.
   * @param args - Merchant domain and optional name, ticker, LEI, and country.
   * @returns JSON with the API body and the USDC payment transaction hash.
   */
  @CreateAction({
    name: "merchant_check",
    description: [
      "Neutral facts about a merchant (domain age, email auth, OFAC name screen, LEI/SEC match) before paying it.",
      NEUTRAL_FACTS_DISCLAIMER,
      PAYMENT_NOTE,
    ].join(" "),
    schema: MerchantCheckSchema,
  })
  async merchantCheck(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof MerchantCheckSchema>,
  ): Promise<string> {
    return this.paidGet(walletProvider, MERCHANT_CHECK_PATH, {
      domain: args.domain,
      name: args.name,
      ticker: args.ticker,
      lei: args.lei,
      country: args.country,
    });
  }

  /**
   * Base mainnet and Base Sepolia only. Payment is USDC on those networks.
   *
   * @param network - The wallet network.
   * @returns True when the wallet is on Base mainnet or Base Sepolia.
   */
  supportsNetwork = (network: Network): boolean =>
    network.protocolFamily === "evm" &&
    (network.networkId === "base-mainnet" || network.networkId === "base-sepolia");

  /**
   * GETs an endpoint, refuses a quote that is not payable USDC within the cap, then pays.
   *
   * @param walletProvider - The wallet that would sign the payment.
   * @param path - API path.
   * @param query - Query parameters.
   * @returns JSON for the agent.
   */
  private async paidGet(
    walletProvider: EvmWalletProvider,
    path: string,
    query: Record<string, string | null | undefined>,
  ): Promise<string> {
    const url = buildGatewayUrl(this.baseUrl, path, query);

    try {
      const quoteResponse = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const quoteBody = await readResponseBody(quoteResponse);

      if (quoteResponse.status === 402) {
        const refusal = this.refusalForQuote(walletProvider, quoteResponse, quoteBody);
        if (refusal) {
          return refusal;
        }
      } else if (!quoteResponse.ok) {
        return jsonError(
          "Request failed",
          `The endpoint returned HTTP ${quoteResponse.status} before payment.`,
          { status: quoteResponse.status, data: quoteBody },
        );
      } else {
        return JSON.stringify({ success: true, data: quoteBody, paymentTxHash: null });
      }

      const client = new x402Client();
      registerExactEvmScheme(client, { signer: createEvmX402Signer(walletProvider) });
      const maxPaymentUsdc = this.maxPaymentUsdc;
      client.registerPolicy((_version, requirements) =>
        requirements.filter(
          requirement =>
            selectUsdcPayment(
              [
                {
                  network: requirement.network,
                  asset: requirement.asset,
                  amount: requirement.amount,
                },
              ],
              walletProvider,
              maxPaymentUsdc,
            ).ok,
        ),
      );

      const fetchWithPayment = wrapFetchWithPayment(fetch, client);
      const paidResponse = await fetchWithPayment(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      const paidBody = await readResponseBody(paidResponse);

      if (paidResponse.status !== 200) {
        return jsonError(
          "Request failed",
          `The endpoint returned HTTP ${paidResponse.status}. Payment was not treated as settled.`,
          { status: paidResponse.status, data: paidBody },
        );
      }

      return JSON.stringify({
        success: true,
        data: paidBody,
        paymentTxHash: paymentTxHashFromResponse(paidResponse),
      });
    } catch (error) {
      return handleHttpError(error, url);
    }
  }

  /**
   * Returns an error JSON string when the 402 quote must not be paid.
   * Returning null means the quote is USDC on this network and within the cap.
   * This runs before `toSigner()` so a refusal does not sign.
   *
   * @param walletProvider - The wallet that would pay.
   * @param response - The unpaid 402 response.
   * @param body - The parsed 402 body.
   * @returns An error string, or null when payment is allowed.
   */
  private refusalForQuote(
    walletProvider: EvmWalletProvider,
    response: Response,
    body: unknown,
  ): string | null {
    const options = readQuotedPayments(response, body);
    if (!options) {
      return jsonError(
        "Unreadable payment requirements",
        "The endpoint returned 402 but the USDC quote could not be read, so no payment was signed.",
      );
    }

    const selection = selectUsdcPayment(options, walletProvider, this.maxPaymentUsdc);
    if (selection.ok) {
      return null;
    }

    return jsonError(
      selection.message,
      selection.details,
      selection.maxPaymentUsdc === undefined
        ? undefined
        : { maxPaymentUsdc: selection.maxPaymentUsdc },
    );
  }
}

/**
 * Creates a Stablecoin Gateways action provider.
 *
 * @param config - Optional API origin and per-call USDC cap.
 * @returns A provider with `screen_crypto_address`, `counterparty_check`, and `merchant_check`.
 */
export const stablecoinGatewaysActionProvider = (config: StablecoinGatewaysConfig = {}) =>
  new StablecoinGatewaysActionProvider(config);
