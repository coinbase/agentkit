import { z } from "zod";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider, WalletProvider } from "../../wallet-providers";
import {
  READ_LITE_NETWORK_ID,
  READ_LITE_PRICE_ATOMIC,
  READ_LITE_PRICE_USDC,
  READ_LITE_URL,
} from "./constants";
import { ReadLiteConfig, ReadUrlLiteSchema } from "./schemas";
import { decodePaymentRequirements, truncatePageMarkdown, validateReadLitePayment } from "./utils";

/**
 * ReadLiteActionProvider is the cheap page-reading tier for agent loops.
 *
 * One action, `read_url_lite`: pays $0.005 USDC on Base via x402 to the
 * Read Lite endpoint, which fetches a web page and returns clean
 * Markdown only (url, title, excerpt, markdown, wordCount) — no search,
 * no synthesis, no extra providers. Built for high-volume loops that
 * read many pages and need the per-read cost near zero.
 *
 * Spend safety: the endpoint URL is a constant, not caller-supplied
 * (the page URL being read is the caller's; the URL being paid is not).
 * Before signing anything, the provider reads the endpoint's 402, and
 * refuses to pay unless the ask is exactly the expected terms —
 * Base mainnet, at most $0.005, to the known Read Lite payTo.
 * A failed read (HTTP 502 from the endpoint) is never charged.
 */
export class ReadLiteActionProvider extends ActionProvider<WalletProvider> {
  private readonly url: string;
  private readonly maxPaymentAtomic: string;

  /**
   * Constructs a new ReadLiteActionProvider.
   *
   * @param config - Optional endpoint URL / payment cap overrides.
   * The payment cap can only be lowered below $0.005, never raised.
   */
  constructor(config: ReadLiteConfig = {}) {
    super("readlite", []);
    this.url = config.url ?? READ_LITE_URL;
    const maxUsdc = Math.min(config.maxPaymentUsdc ?? READ_LITE_PRICE_USDC, READ_LITE_PRICE_USDC);
    this.maxPaymentAtomic = String(Math.round(maxUsdc * 1_000_000));
    if (this.maxPaymentAtomic > READ_LITE_PRICE_ATOMIC) {
      this.maxPaymentAtomic = READ_LITE_PRICE_ATOMIC;
    }
  }

  /**
   * Reads a web page as clean Markdown.
   *
   * @param walletProvider - The wallet provider that pays the $0.005 x402 call.
   * @param args - The page URL to read.
   * @returns The page as stringified JSON: url, title, excerpt, markdown, wordCount.
   */
  @CreateAction({
    name: "read_url_lite",
    description: `Read a web page as clean Markdown. Costs $0.005 USDC on Base, paid via x402; no API key.

Inputs:
- url: The web page URL to fetch (https://...)

Returns the page as JSON: url, title, excerpt, markdown (the page body as clean Markdown), and wordCount (of the full page). Very long pages have their markdown truncated (markdownTruncated: true) — wordCount still reports the full size.

Use this when you need the contents of a specific page — an article, a doc page, a listing — especially inside loops that read many pages. It returns Markdown only: no search, no summarisation. A failed read returns an error and is never charged.`,
    schema: ReadUrlLiteSchema,
  })
  async readUrlLite(
    walletProvider: WalletProvider,
    args: z.infer<typeof ReadUrlLiteSchema>,
  ): Promise<string> {
    try {
      if (!(walletProvider instanceof EvmWalletProvider)) {
        return JSON.stringify({
          success: false,
          error: "Read Lite pays USDC on Base and requires an EVM wallet provider",
        });
      }

      const body = JSON.stringify({ url: args.url });

      // Pre-flight, unpaid: read the 402 and pin the payment terms
      // before any signer is involved.
      const preflight = await fetch(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (preflight.status === 200) {
        const page = await preflight.json();
        return JSON.stringify({ success: true, page: truncatePageMarkdown(page) }, null, 2);
      }
      if (preflight.status !== 402) {
        return JSON.stringify({
          success: false,
          error: `Read Lite failed: HTTP ${preflight.status}. A failed read is never charged.`,
        });
      }
      const requirements = decodePaymentRequirements(preflight.headers.get("payment-required"));
      const paymentError = validateReadLitePayment(requirements?.accepts, this.maxPaymentAtomic);
      if (paymentError) {
        return JSON.stringify({
          success: false,
          error: `Refusing to pay Read Lite: ${paymentError}`,
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
          error: `Read Lite failed: HTTP ${response.status}. Payment is not settled on a failed read.`,
        });
      }
      const page = await response.json();
      return JSON.stringify({ success: true, page: truncatePageMarkdown(page) }, null, 2);
    } catch (error: unknown) {
      return JSON.stringify({
        success: false,
        error: `Error reading page: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Checks if the provider supports the given network.
   * Read Lite pays on Base mainnet only.
   *
   * @param network - The network to check.
   * @returns True only for base-mainnet.
   */
  supportsNetwork = (network: Network) => network.networkId === READ_LITE_NETWORK_ID;
}

export const readLiteActionProvider = (config?: ReadLiteConfig) =>
  new ReadLiteActionProvider(config);
