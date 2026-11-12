import { z } from "zod";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider, SvmWalletProvider, WalletProvider } from "../../wallet-providers";
import { CheckX402SellerSchema, ScreenSanctionsSchema, TolcaConfig } from "./schemas";

const DEFAULT_BASE_URL = "https://tolca.tonbot.ca";
const DEFAULT_MAX_PRICE_USDC = 0.02;
const SUPPORTED_NETWORK_IDS = ["base-mainnet", "solana-mainnet"];

/**
 * Wallets that receive payment for Tolca calls. The provider refuses to pay anyone else.
 */
const TOLCA_PAY_TO = new Set([
  "0x35f0b86a7e33f561faf7cfa5654cad9162c4a17d",
  "9e4z6QAGPT9Nj7nDsxQT7Vthbx8d8NnYCLWrejL2SZsJ",
]);

/** Official USDC contracts on the networks Tolca accepts. */
const USDC_ASSETS = new Set([
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
]);

type PaymentOption = {
  payTo?: string;
  asset?: string;
  amount?: string;
  maxAmountRequired?: string;
};

/**
 * Normalize an address for comparison: EVM addresses are case-insensitive, Solana ones are not.
 *
 * @param address - The address to normalize.
 * @returns The normalized address.
 */
function normalize(address: string): string {
  return address.startsWith("0x") ? address.toLowerCase() : address;
}

/**
 * Extract a readable message from an unknown error.
 *
 * @param error - The error to describe.
 * @returns A readable message.
 */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * TolcaActionProvider lets an agent check who it is about to pay.
 *
 * - check_x402_seller: before paying an x402 seller, screen its payTo wallet against OFAC
 *   crypto addresses, confirm the asset is the official USDC on its network, and compare price
 *   and payTo with the seller's Coinbase x402 Bazaar listing. Returns allow / review / block.
 * - screen_sanctions: screen a company or person name against US, UK, EU and Canadian lists.
 *
 * Each call is paid per use over x402 (USDC on Base or Solana) from the agent's wallet.
 * The provider only pays Tolca's own wallets, in official USDC, up to maxPriceUsdc per call.
 */
export class TolcaActionProvider extends ActionProvider<WalletProvider> {
  private readonly baseUrl: string;
  private readonly maxPriceUsdc: number;

  /**
   * Creates a new TolcaActionProvider.
   *
   * @param config - Optional base URL and per-call price cap.
   */
  constructor(config: TolcaConfig = {}) {
    super("tolca", []);
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.maxPriceUsdc = config.maxPriceUsdc ?? DEFAULT_MAX_PRICE_USDC;
  }

  /**
   * Checks an x402 seller before the agent pays it.
   *
   * @param walletProvider - The wallet that pays for the check.
   * @param args - The seller URL or its 402 payment request, and an optional seller name.
   * @returns A JSON string with Tolca's verdict, or an error.
   */
  @CreateAction({
    name: "check_x402_seller",
    description: `
Checks an x402 seller BEFORE the agent pays it, using Tolca payment-check ($0.01 USDC, paid automatically from the wallet).

Use it before paying a seller the agent has not paid before, or when the price or wallet looks unusual.
Provide either:
- url: the seller endpoint (Tolca reads its 402 payment request without paying it), or
- paymentRequired: the decoded 402 payment request the agent already received.
Optionally add sellerName to also screen the company behind the seller against sanctions lists.

Tolca checks the payTo wallet against OFAC SDN crypto addresses, that the asset is the official USDC on its network, that the network is a mainnet, and that price and payTo match the seller's Coinbase x402 Bazaar listing.

The answer has an "action":
- allow: safe to pay
- review: do not pay automatically; ask a human
- block: do not pay
It also lists the reasons and includes a signed receipt the agent can keep as evidence.`,
    schema: CheckX402SellerSchema,
  })
  async checkX402Seller(
    walletProvider: WalletProvider,
    args: z.infer<typeof CheckX402SellerSchema>,
  ): Promise<string> {
    if (!args.url && !args.paymentRequired) {
      return JSON.stringify({
        success: false,
        error: "Provide url (the seller endpoint) or paymentRequired (its 402 payment request).",
      });
    }

    const body: Record<string, unknown> = args.paymentRequired
      ? { payment_required: args.paymentRequired }
      : { url: args.url };
    if (args.sellerName) {
      body.seller_name = args.sellerName;
    }

    try {
      const { status, data } = await this.paidPost(walletProvider, "/v1/payment-check", body);
      if (status !== 200) {
        return JSON.stringify({ success: false, status, data });
      }
      const result = data as Record<string, unknown>;
      return JSON.stringify({ success: true, verdict: result.action, ...result });
    } catch (error) {
      return JSON.stringify({ success: false, error: errorMessage(error) });
    }
  }

  /**
   * Screens a company or person name against sanctions lists.
   *
   * @param walletProvider - The wallet that pays for the check.
   * @param args - The name to screen.
   * @returns A JSON string with Tolca's verdict, or an error.
   */
  @CreateAction({
    name: "screen_sanctions",
    description: `
Screens a company or person name against US (Consolidated Screening List, incl. OFAC SDN), UK, EU and Canadian sanctions lists, using Tolca ($0.005 USDC, paid automatically from the wallet).

Use it before paying, hiring or signing with a counterparty the agent does not know.
The answer has an "action" (allow / review / block), the matching list entries if any, the date of each list, and a signed receipt.
A "review" means a possible match that a human should look at.`,
    schema: ScreenSanctionsSchema,
  })
  async screenSanctions(
    walletProvider: WalletProvider,
    args: z.infer<typeof ScreenSanctionsSchema>,
  ): Promise<string> {
    try {
      const { status, data } = await this.paidPost(walletProvider, "/v1/sanctions-check", {
        name: args.name,
      });
      if (status !== 200) {
        return JSON.stringify({ success: false, status, data });
      }
      const result = data as Record<string, unknown>;
      return JSON.stringify({ success: true, verdict: result.action, ...result });
    } catch (error) {
      return JSON.stringify({ success: false, error: errorMessage(error) });
    }
  }

  /**
   * Tolca accepts payment on Base mainnet and Solana mainnet.
   *
   * @param network - The network to check.
   * @returns True if the wallet can pay Tolca on this network.
   */
  supportsNetwork = (network: Network) => SUPPORTED_NETWORK_IDS.includes(network.networkId ?? "");

  /**
   * POSTs to Tolca, checks the 402 payment request, then pays it from the wallet.
   *
   * @param walletProvider - The wallet that pays.
   * @param path - The Tolca API path.
   * @param body - The JSON body.
   * @returns The HTTP status and parsed response.
   */
  private async paidPost(
    walletProvider: WalletProvider,
    path: string,
    body: Record<string, unknown>,
  ): Promise<{ status: number; data: unknown }> {
    if (
      !(walletProvider instanceof EvmWalletProvider || walletProvider instanceof SvmWalletProvider)
    ) {
      throw new Error("Only EVM and Solana wallet providers can pay for Tolca calls.");
    }

    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };

    // 1. Ask without paying: Tolca answers 402 with its price and wallet.
    const unpaid = await fetch(url, init);
    if (unpaid.status !== 402) {
      return { status: unpaid.status, data: await this.parse(unpaid) };
    }

    // 2. Pay only Tolca's own wallets, in official USDC, up to the price cap.
    const options = await this.paymentOptions(unpaid);
    const cap = Math.round(this.maxPriceUsdc * 1_000_000);
    const unsafe = options.filter(option => {
      const payTo = normalize(String(option.payTo ?? ""));
      const asset = normalize(String(option.asset ?? ""));
      const amount = Number(option.amount ?? option.maxAmountRequired ?? NaN);
      return (
        !TOLCA_PAY_TO.has(payTo) ||
        !USDC_ASSETS.has(asset) ||
        !Number.isFinite(amount) ||
        amount > cap
      );
    });
    if (options.length === 0 || unsafe.length > 0) {
      throw new Error(
        "Unexpected price, asset or wallet in Tolca's payment request: nothing was paid.",
      );
    }

    // 3. Pay and get the answer.
    const client = await this.createX402Client(walletProvider);
    const paidFetch = wrapFetchWithPayment(fetch, client);
    const paid = await paidFetch(url, init);
    return { status: paid.status, data: await this.parse(paid) };
  }

  /**
   * Reads the payment options from a 402 response (PAYMENT-REQUIRED header, or the body for x402 v1).
   *
   * @param response - The 402 response.
   * @returns The payment options.
   */
  private async paymentOptions(response: Response): Promise<PaymentOption[]> {
    const header = response.headers.get("payment-required");
    let decoded: unknown;
    if (header) {
      decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8"));
    } else {
      decoded = await response.json();
    }
    const accepts = (decoded as { accepts?: unknown })?.accepts;
    return Array.isArray(accepts) ? (accepts as PaymentOption[]) : [];
  }

  /**
   * Parses a response as JSON when possible, otherwise as text.
   *
   * @param response - The response to parse.
   * @returns The parsed body.
   */
  private async parse(response: Response): Promise<unknown> {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  /**
   * Creates an x402 client that signs with the agent's wallet.
   *
   * @param walletProvider - The EVM or Solana wallet provider.
   * @returns The configured x402 client.
   */
  private async createX402Client(walletProvider: WalletProvider): Promise<x402Client> {
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
    } else if (walletProvider instanceof SvmWalletProvider) {
      const signer = await walletProvider.toSigner();
      registerExactSvmScheme(client, { signer });
    }
    return client;
  }
}

/**
 * Factory function to create a new TolcaActionProvider.
 *
 * @param config - Optional base URL and per-call price cap.
 * @returns A new TolcaActionProvider.
 */
export const tolcaActionProvider = (config?: TolcaConfig) => new TolcaActionProvider(config);
