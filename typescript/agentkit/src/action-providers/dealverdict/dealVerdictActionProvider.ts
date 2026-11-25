import { z } from "zod";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider, WalletProvider } from "../../wallet-providers";
import {
  DEAL_VERDICT_NETWORK_ID,
  DEAL_VERDICT_PRICE_ATOMIC,
  DEAL_VERDICT_PRICE_USDC,
  DEAL_VERDICT_URL,
} from "./constants";
import { CheckDealSchema, DealVerdictConfig } from "./schemas";
import { decodePaymentRequirements, isBuyAllowed, validateDealVerdictPayment } from "./utils";

/**
 * DealVerdictActionProvider is a pre-checkout deal gate for shopping agents.
 *
 * One action, `check_deal`: pays $0.01 USDC on Base via x402 to the
 * Deal Verdict endpoint and returns its verdict card
 * (real_deal / fake_discount / overpriced / fair, the lowest price found
 * elsewhere, the typical price, and cited sources).
 *
 * Gate rule: a purchase at the checked price may proceed only on
 * real_deal or fair. fake_discount / overpriced (and any unknown
 * verdict) block the purchase at this price — buy at the card's
 * lowestFound instead, or renegotiate.
 *
 * Spend safety: the endpoint URL is a constant, not caller-supplied.
 * Before signing anything, the provider reads the endpoint's 402,
 * and refuses to pay unless the ask is exactly the expected terms —
 * Base mainnet, at most $0.01, to the known Deal Verdict payTo.
 * A failed check (HTTP 502 from the endpoint, fewer than 3 priced
 * sources) is never charged.
 */
export class DealVerdictActionProvider extends ActionProvider<WalletProvider> {
  private readonly url: string;
  private readonly maxPaymentAtomic: string;

  /**
   * Constructs a new DealVerdictActionProvider.
   *
   * @param config - Optional endpoint URL / payment cap overrides.
   * The payment cap can only be lowered below $0.01, never raised.
   */
  constructor(config: DealVerdictConfig = {}) {
    super("dealverdict", []);
    this.url = config.url ?? DEAL_VERDICT_URL;
    const maxUsdc = Math.min(
      config.maxPaymentUsdc ?? DEAL_VERDICT_PRICE_USDC,
      DEAL_VERDICT_PRICE_USDC,
    );
    this.maxPaymentAtomic = String(Math.round(maxUsdc * 1_000_000));
    if (this.maxPaymentAtomic > DEAL_VERDICT_PRICE_ATOMIC) {
      this.maxPaymentAtomic = DEAL_VERDICT_PRICE_ATOMIC;
    }
  }

  /**
   * Checks whether a price is a real deal before buying.
   *
   * @param walletProvider - The wallet provider that pays the $0.01 x402 call.
   * @param args - The product and the price the agent found.
   * @returns The verdict card as stringified JSON, plus `allowed` (the gate rule).
   */
  @CreateAction({
    name: "check_deal",
    description: `Check whether a price is a real deal BEFORE buying. Costs $0.01 USDC on Base, paid via x402; no API key.

Inputs:
- product: The product name (or product page URL) whose price should be checked
- price: The price you found for this product, in USD
- compareAtPrice: Optional claimed original ("was") price shown by the listing — used to detect fake discounts
- url: Optional product page URL where the price was found

Returns a verdict card: verdict (real_deal | fake_discount | overpriced | fair), lowestFound (price, sourceUrl, store), typicalPrice, savingsVsTypical, and the cited sources behind every price.

Gate rule — follow it exactly:
- real_deal or fair: buy at this price (allowed: true)
- fake_discount or overpriced: DO NOT buy at this price (allowed: false) — use lowestFound instead

Always call this before checking out, especially on Black Friday / Cyber Monday listings with inflated "was" prices. A failed check (too few priced sources) returns an error and is never charged.`,
    schema: CheckDealSchema,
  })
  async checkDeal(
    walletProvider: WalletProvider,
    args: z.infer<typeof CheckDealSchema>,
  ): Promise<string> {
    try {
      if (!(walletProvider instanceof EvmWalletProvider)) {
        return JSON.stringify({
          success: false,
          error: "Deal Verdict pays USDC on Base and requires an EVM wallet provider",
        });
      }

      const body = JSON.stringify({
        product: args.product,
        price: args.price,
        ...(args.compareAtPrice !== undefined ? { compareAtPrice: args.compareAtPrice } : {}),
        ...(args.url !== undefined ? { url: args.url } : {}),
      });

      // Pre-flight, unpaid: read the 402 and pin the payment terms
      // before any signer is involved.
      const preflight = await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (preflight.status === 200) {
        const card = await preflight.json();
        return JSON.stringify({ success: true, allowed: isBuyAllowed(card), card }, null, 2);
      }
      if (preflight.status !== 402) {
        return JSON.stringify({
          success: false,
          error: `Deal Verdict failed: HTTP ${preflight.status}. A failed check is never charged.`,
        });
      }
      const requirements = decodePaymentRequirements(preflight.headers.get("payment-required"));
      const paymentError = validateDealVerdictPayment(requirements?.accepts, this.maxPaymentAtomic);
      if (paymentError) {
        return JSON.stringify({
          success: false,
          error: `Refusing to pay Deal Verdict: ${paymentError}`,
        });
      }

      // Pay exactly the validated ask and retry.
      const client = new x402Client();
      const account = walletProvider.toSigner();
      const signer = {
        ...account,
        readContract: (signerArgs: {
          address: `0x${string}`;
          abi: readonly unknown[];
          functionName: string;
          args?: readonly unknown[];
        }) =>
          walletProvider.readContract({
            address: signerArgs.address,
            abi: signerArgs.abi as never,
            functionName: signerArgs.functionName as never,
            args: signerArgs.args as never,
          }),
      };
      registerExactEvmScheme(client, { signer });
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);

      const response = await fetchWithPayment(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (!response.ok) {
        return JSON.stringify({
          success: false,
          error: `Deal Verdict failed: HTTP ${response.status}. Payment is not settled on a failed check.`,
        });
      }
      const card = await response.json();
      return JSON.stringify({ success: true, allowed: isBuyAllowed(card), card }, null, 2);
    } catch (error: unknown) {
      return JSON.stringify({
        success: false,
        error: `Error checking deal: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Checks if the provider supports the given network.
   * Deal Verdict payments are Base mainnet only.
   *
   * @param network - The network to check.
   * @returns True only for base-mainnet.
   */
  supportsNetwork = (network: Network) => network.networkId === DEAL_VERDICT_NETWORK_ID;
}

export const dealVerdictActionProvider = (config?: DealVerdictConfig) =>
  new DealVerdictActionProvider(config);
