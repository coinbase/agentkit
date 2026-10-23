import { z } from "zod";
import { x402Client, wrapFetchWithPayment } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { registerExactSvmScheme } from "@x402/svm/exact/client";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider, SvmWalletProvider, WalletProvider } from "../../wallet-providers";
import { DEFAULT_MAX_PRICE_USD, TOOLS, ToolSpec, YOURAITOOLS_API_BASE } from "./constants";
import {
  CheckTokenSchema,
  FindPaidApiSchema,
  ReadUrlSchema,
  ScanTextSchema,
  ScreenAddressSchema,
  SmartMoneySchema,
  YourAIToolsActionProviderConfig,
} from "./schemas";

/**
 * One accepted payment option from an x402 402 response.
 */
interface X402Accept {
  network?: string;
  amount?: string;
  maxAmountRequired?: string;
  payTo?: string;
  asset?: string;
  resource?: string;
}

/**
 * v1 body or decoded v2 PAYMENT-REQUIRED document.
 */
interface X402PaymentDocument {
  x402Version?: number;
  resource?: { url?: string };
  accepts?: X402Accept[];
}

/**
 * Resolved configuration with defaults applied.
 */
interface ResolvedConfig {
  payWithWallet: boolean;
  maxPriceUsd: number;
  apiBase: string;
  creditsKey?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Fetch function shape shared by the global fetch and the x402 payment wrapper.
 */
type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * Decode a base64 JSON document.
 *
 * @param value - Base64-encoded JSON
 * @returns The parsed document, or null when the value is not valid JSON
 */
function decodeBase64Json(value: string): X402PaymentDocument | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value.trim(), "base64").toString("utf8"));
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed as X402PaymentDocument;
  } catch {
    return null;
  }
}

/**
 * Summarize the x402 terms of a 402 response. This never pays.
 *
 * v2 terms are read from the base64 `PAYMENT-REQUIRED` header. v1 terms are read from the body.
 *
 * @param headers - Response headers
 * @param body - Parsed response body, used for v1 payment terms
 * @returns Payment terms the caller can show, or pay later with `payWithWallet`
 */
export function parsePaymentRequired(headers: Headers, body: unknown) {
  const headerValue = headers.get("payment-required");
  const doc = headerValue ? decodeBase64Json(headerValue) : null;
  const bodyDoc =
    body && typeof body === "object" ? (body as X402PaymentDocument) : ({} as X402PaymentDocument);
  const source = doc || bodyDoc;
  const accepts = doc?.accepts || bodyDoc.accepts || [];

  return {
    payment_required: true as const,
    x402_version: source.x402Version ?? null,
    resource: doc?.resource?.url || accepts[0]?.resource || null,
    options: accepts.map(accept => ({
      network: accept.network,
      price_usd: Number(accept.amount ?? accept.maxAmountRequired) / 1e6,
      pay_to: accept.payTo,
      asset: accept.asset,
    })),
    how_to_pay:
      "Enable payWithWallet (pays with this AgentKit wallet via x402) or set a prepaid creditsKey. This provider never holds funds.",
  };
}

/**
 * YourAIToolsActionProvider calls six pay-per-call x402 APIs operated by the provider author:
 * OFAC address screen, Base token safety, Hyperliquid smart-money positioning, paid-API finder,
 * web page to Markdown, and prompt-injection scan.
 *
 * Each call is priced in USDC. The provider does not custody funds. `payWithWallet` is off by
 * default, and a per-call spend cap is enforced before any request.
 */
export class YourAIToolsActionProvider extends ActionProvider<WalletProvider> {
  private readonly config: ResolvedConfig;

  /**
   * Creates a YourAIToolsActionProvider.
   *
   * @param config - Optional payment and endpoint configuration
   */
  constructor(config: YourAIToolsActionProviderConfig = {}) {
    super("youraitools", []);
    this.config = {
      payWithWallet: config.payWithWallet ?? false,
      maxPriceUsd: config.maxPriceUsd ?? DEFAULT_MAX_PRICE_USD,
      apiBase: config.apiBase ?? YOURAITOOLS_API_BASE,
      creditsKey: config.creditsKey,
      fetchImpl: config.fetchImpl,
    };
  }

  /**
   * Screen an address against the US Treasury OFAC SDN list.
   *
   * @param walletProvider - Wallet used only when `payWithWallet` is enabled
   * @param args - Address to screen
   * @returns JSON string with the screen result, 402 terms, or an error
   */
  @CreateAction({
    name: "payguard_screen_address",
    description: TOOLS[0].description,
    schema: ScreenAddressSchema,
  })
  async screenAddress(
    walletProvider: WalletProvider,
    args: z.infer<typeof ScreenAddressSchema>,
  ): Promise<string> {
    return this.callTool(walletProvider, this.spec("payguard_screen_address"), args.address);
  }

  /**
   * Check a Base ERC-20 before buying, accepting, or approving it.
   *
   * @param walletProvider - Wallet used only when `payWithWallet` is enabled
   * @param args - Token contract address
   * @returns JSON string with the safety result, 402 terms, or an error
   */
  @CreateAction({
    name: "tokenverdict_check_token",
    description: TOOLS[1].description,
    schema: CheckTokenSchema,
  })
  async checkToken(
    walletProvider: WalletProvider,
    args: z.infer<typeof CheckTokenSchema>,
  ): Promise<string> {
    return this.callTool(walletProvider, this.spec("tokenverdict_check_token"), args.token);
  }

  /**
   * Read what the most profitable Hyperliquid traders currently hold for a coin.
   *
   * @param walletProvider - Wallet used only when `payWithWallet` is enabled
   * @param args - Coin symbol
   * @returns JSON string with the positioning result, 402 terms, or an error
   */
  @CreateAction({
    name: "smartperps_smart_money",
    description: TOOLS[2].description,
    schema: SmartMoneySchema,
  })
  async smartMoney(
    walletProvider: WalletProvider,
    args: z.infer<typeof SmartMoneySchema>,
  ): Promise<string> {
    return this.callTool(walletProvider, this.spec("smartperps_smart_money"), args.symbol);
  }

  /**
   * Rank paid x402 APIs for a task from the public discovery indexes.
   *
   * @param walletProvider - Wallet used only when `payWithWallet` is enabled
   * @param args - Capability the agent needs
   * @returns JSON string with the ranking, 402 terms, or an error
   */
  @CreateAction({
    name: "toolpick_find_paid_api",
    description: TOOLS[3].description,
    schema: FindPaidApiSchema,
  })
  async findPaidApi(
    walletProvider: WalletProvider,
    args: z.infer<typeof FindPaidApiSchema>,
  ): Promise<string> {
    return this.callTool(walletProvider, this.spec("toolpick_find_paid_api"), args.need);
  }

  /**
   * Read a public web page as clean Markdown.
   *
   * @param walletProvider - Wallet used only when `payWithWallet` is enabled
   * @param args - URL to read
   * @returns JSON string with the page, 402 terms, or an error
   */
  @CreateAction({
    name: "webread_read_url",
    description: TOOLS[4].description,
    schema: ReadUrlSchema,
  })
  async readUrl(
    walletProvider: WalletProvider,
    args: z.infer<typeof ReadUrlSchema>,
  ): Promise<string> {
    return this.callTool(walletProvider, this.spec("webread_read_url"), args.url);
  }

  /**
   * Scan untrusted text for prompt injection before acting on it.
   *
   * @param walletProvider - Wallet used only when `payWithWallet` is enabled
   * @param args - Text to scan
   * @returns JSON string with the scan result, 402 terms, or an error
   */
  @CreateAction({
    name: "injectscan_scan_text",
    description: TOOLS[5].description,
    schema: ScanTextSchema,
  })
  async scanText(
    walletProvider: WalletProvider,
    args: z.infer<typeof ScanTextSchema>,
  ): Promise<string> {
    return this.callTool(walletProvider, this.spec("injectscan_scan_text"), args.text);
  }

  /**
   * Unpaid calls work on any network. Wallet payments use the x402 networks the wallet supports.
   *
   * @param _network - The network to check
   * @returns True. This provider does not restrict the wallet network.
   */
  supportsNetwork = (_network: Network): boolean => true;

  /**
   * Call one YourAITools endpoint, enforcing the spend cap and optional x402 payment.
   *
   * @param walletProvider - Wallet used to sign an x402 payment when `payWithWallet` is on
   * @param spec - Endpoint metadata
   * @param value - Query parameter value
   * @returns JSON string with the result, 402 terms, or an error
   */
  private async callTool(
    walletProvider: WalletProvider,
    spec: ToolSpec,
    value: string,
  ): Promise<string> {
    if (spec.priceUsd > this.config.maxPriceUsd) {
      return JSON.stringify({
        error: "over_budget",
        message: `${spec.name} costs $${spec.priceUsd} per call, above maxPriceUsd=${this.config.maxPriceUsd}. Not called.`,
      });
    }

    const base = this.config.fetchImpl ?? fetch;
    let request: FetchLike = base;

    if (this.config.payWithWallet && !this.config.creditsKey) {
      if (
        !(walletProvider instanceof EvmWalletProvider) &&
        !(walletProvider instanceof SvmWalletProvider)
      ) {
        return JSON.stringify({
          error: "unsupported_wallet",
          message: "payWithWallet needs an EVM or SVM wallet provider",
        });
      }

      const client = await this.createX402Client(walletProvider);
      request = wrapFetchWithPayment(base, client);
    }

    const url = `${this.config.apiBase.replace(/\/+$/, "")}${spec.path}?${new URLSearchParams({
      [spec.param]: value,
    })}`;
    const headers: Record<string, string> = {
      accept: "application/json",
      "user-agent": "agentkit-youraitools/0.1",
    };
    if (this.config.creditsKey) {
      headers.authorization = `Bearer ${this.config.creditsKey}`;
    }

    try {
      const response = await request(url, { method: "GET", headers });
      const text = await response.text();
      let body: unknown = null;
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }

      if (response.status === 402) {
        return JSON.stringify({
          ...parsePaymentRequired(response.headers, body),
          tool: spec.name,
          list_price_usd: spec.priceUsd,
        });
      }

      if (response.status >= 400) {
        const record =
          body && typeof body === "object" ? (body as { error?: unknown; message?: unknown }) : {};
        const message = typeof record.message === "string" ? record.message : text.slice(0, 300);
        return JSON.stringify({
          error: record.error || `http_${response.status}`,
          message,
          charged: false,
        });
      }

      return JSON.stringify({ tool: spec.name, result: body ?? text.slice(0, 8000) }).slice(
        0,
        12000,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return JSON.stringify({
        error: "request_failed",
        message: message.slice(0, 300),
      });
    }
  }

  /**
   * Look up static metadata for an action name.
   *
   * @param name - Action name
   * @returns The matching tool spec
   */
  private spec(name: string): ToolSpec {
    const found = TOOLS.find(tool => tool.name === name);
    if (!found) {
      throw new Error(`Unknown YourAITools action: ${name}`);
    }
    return found;
  }

  /**
   * Creates an x402 client for the wallet. The EVM signer includes `readContract`, matching
   * `X402ActionProvider`, so USDC allowance reads work during payment.
   *
   * @param walletProvider - The wallet provider to configure the client for
   * @returns Configured x402 client
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
 * Factory for {@link YourAIToolsActionProvider}.
 *
 * @param config - Optional payment and endpoint configuration
 * @returns A configured provider
 */
export const youraitoolsActionProvider = (config?: YourAIToolsActionProviderConfig) =>
  new YourAIToolsActionProvider(config);
