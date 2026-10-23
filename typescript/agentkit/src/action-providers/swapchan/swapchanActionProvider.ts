import { z } from "zod";
import { Hex, formatUnits, parseUnits } from "viem";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { SwapChanQuoteSchema, SwapChanSwapSchema } from "./schemas";

export const SWAPCHAN_API_URL = "https://api.swapchan.com";
const NATIVE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

/**
 * Configuration for the SwapChanActionProvider.
 */
export interface SwapChanActionProviderConfig {
  /**
   * Optional SwapChan partner id, sent with quotes for fee attribution.
   */
  partnerId?: string;
  /**
   * Override the API base URL (defaults to https://api.swapchan.com).
   */
  apiUrl?: string;
}

interface TxRequest {
  chainId: number;
  to: Hex;
  data: Hex;
  value: string;
}

interface SwapChanQuote {
  id: string;
  provider: string;
  toAmount: string;
  toAmountMin: string;
  gasUsd: number;
  feeUsd: number;
  netUsd: number | null;
  etaSeconds: number;
  expiresAt: number;
  execution?: "tx" | "order" | "nonevm";
}

interface QuotesResponse {
  quotes: SwapChanQuote[];
  best: string | null;
  errors: { provider: string; message: string }[];
}

interface BuildResponse extends TxRequest {
  approval?: TxRequest;
  permit2?: unknown;
  execution?: "tx" | "order" | "nonevm";
}

/**
 * SwapChan Action Provider.
 *
 * SwapChan is a keyless meta-aggregator that queries LI.FI, Relay, 0x, deBridge, THORChain,
 * Jupiter and others and ranks routes by net output. Supports same-chain swaps and bridging
 * from EVM to other EVM chains, Solana, Bitcoin and Tron.
 */
export class SwapChanActionProvider extends ActionProvider<EvmWalletProvider> {
  #partnerId?: string;
  #apiUrl: string;

  /**
   * Constructor for the SwapChanActionProvider.
   *
   * @param config - Optional configuration for the provider.
   */
  constructor(config: SwapChanActionProviderConfig = {}) {
    super("swapchan", []);
    this.#partnerId = config.partnerId || process.env.SWAPCHAN_PARTNER_ID || undefined;
    this.#apiUrl = (config.apiUrl || SWAPCHAN_API_URL).replace(/\/$/, "");
  }

  /**
   * Gets ranked quotes for a swap or bridge.
   *
   * @param walletProvider - The wallet provider.
   * @param args - The input arguments for the action.
   * @returns A JSON string with the ranked quotes.
   */
  @CreateAction({
    name: "get_swap_quote_from_swapchan",
    description: `
This tool fetches ranked swap and bridge quotes from SwapChan, which compares LI.FI, Relay, 0x, deBridge, THORChain and other aggregators.

It takes the following inputs:
- fromToken: The contract address of the token to sell on the wallet's current chain
- toToken: The token to buy (on toChainId if set)
- amount: The amount of fromToken to sell in whole units (e.g. 1 ETH or 10 USDC)
- toChainId: (Optional) Destination chain id for cross-chain swaps
- toAddress: (Optional) Recipient on the destination chain (required for Solana, Bitcoin or Tron)
- slippageBps: (Optional) Maximum allowed slippage in basis points (100 = 1%)

Important notes:
- The contract address for native ETH is "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
- This only fetches quotes and does not execute a swap
- Use amount units exactly as provided, do not convert to wei
- Never assume token addresses. If only a symbol is provided, use the get_token_address tool if available first
`,
    schema: SwapChanQuoteSchema,
  })
  async getQuote(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SwapChanQuoteSchema>,
  ): Promise<string> {
    try {
      const { quotes, best, errors, toDecimals } = await this.#fetchQuotes(walletProvider, args);
      return JSON.stringify({
        success: true,
        best,
        quotes: quotes.slice(0, 5).map(q => ({
          id: q.id,
          provider: q.provider,
          toAmount: formatUnits(BigInt(q.toAmount), toDecimals),
          toAmountMin: formatUnits(BigInt(q.toAmountMin), toDecimals),
          gasUsd: q.gasUsd,
          feeUsd: q.feeUsd,
          etaSeconds: q.etaSeconds,
          executable: isTxRoute(q),
        })),
        ...(errors.length ? { providerErrors: errors } : {}),
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: `Error fetching SwapChan quote: ${error}` });
    }
  }

  /**
   * Executes a swap or bridge at the best transaction-based SwapChan route.
   *
   * @param walletProvider - The wallet provider used to send transactions.
   * @param args - The input arguments for the action.
   * @returns A JSON string with the transaction hash(es).
   */
  @CreateAction({
    name: "execute_swap_on_swapchan",
    description: `
This tool executes a swap or cross-chain bridge at the best route SwapChan finds.

It takes the same inputs as get_swap_quote_from_swapchan.

Important notes:
- This sends real transactions from your wallet
- If the route needs an ERC20 allowance, an approval transaction is sent first
- Routes that need off-chain order signing or Permit2 signatures are skipped
- For cross-chain swaps, funds arrive on the destination chain after the bridge settles; use the returned statusUrl to track it
- First fetch a quote and only execute if you are happy with the price
- Use amount units exactly as provided, do not convert to wei
`,
    schema: SwapChanSwapSchema,
  })
  async swap(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SwapChanSwapSchema>,
  ): Promise<string> {
    let approvalTxHash: Hex | undefined;
    try {
      const { quotes, toDecimals } = await this.#fetchQuotes(walletProvider, args);
      const taker = walletProvider.getAddress();

      let chosen: SwapChanQuote | undefined;
      let built: BuildResponse | undefined;
      const skipped: string[] = [];
      for (const q of quotes.filter(isTxRoute)) {
        const b = await this.#request<BuildResponse>("/build", {
          quoteId: q.id,
          taker,
          ...(args.toAddress ? { recipient: args.toAddress } : {}),
        }).catch(e => {
          skipped.push(`${q.provider}: ${e instanceof Error ? e.message : e}`);
          return undefined;
        });
        if (!b) continue;
        if (b.permit2 || (b.execution && b.execution !== "tx") || !b.to || !b.data) {
          skipped.push(`${q.provider}: requires signature-based execution`);
          continue;
        }
        chosen = q;
        built = b;
        break;
      }
      if (!chosen || !built) {
        return JSON.stringify({
          success: false,
          error: `No executable SwapChan route found${skipped.length ? `: ${skipped.join("; ")}` : ""}`,
        });
      }

      if (built.approval) {
        approvalTxHash = await walletProvider.sendTransaction({
          to: built.approval.to,
          data: built.approval.data,
          value: BigInt(built.approval.value || "0"),
        });
        const receipt = await walletProvider.waitForTransactionReceipt(approvalTxHash);
        if (receipt?.status && receipt.status !== "success") {
          return JSON.stringify({
            success: false,
            error: "Approval transaction failed",
            approvalTxHash,
          });
        }
      }

      const txHash = await walletProvider.sendTransaction({
        to: built.to,
        data: built.data,
        value: BigInt(built.value || "0"),
      });
      const receipt = await walletProvider.waitForTransactionReceipt(txHash);
      if (receipt?.status && receipt.status !== "success") {
        return JSON.stringify({
          success: false,
          error: "Swap transaction failed",
          txHash,
          ...(approvalTxHash ? { approvalTxHash } : {}),
        });
      }

      const network = walletProvider.getNetwork();
      const toChainId = args.toChainId ?? Number(network.chainId);
      return JSON.stringify({
        success: true,
        provider: chosen.provider,
        txHash,
        ...(approvalTxHash ? { approvalTxHash } : {}),
        expectedToAmount: formatUnits(BigInt(chosen.toAmount), toDecimals),
        minToAmount: formatUnits(BigInt(chosen.toAmountMin), toDecimals),
        statusUrl:
          `${this.#apiUrl}/status?provider=${encodeURIComponent(chosen.provider)}` +
          `&txHash=${txHash}&fromChainId=${network.chainId}&toChainId=${toChainId}`,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Error executing SwapChan swap: ${error}`,
        ...(approvalTxHash ? { approvalTxHash } : {}),
      });
    }
  }

  /**
   * Checks if the SwapChan action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True for EVM networks.
   */
  supportsNetwork = (network: Network) => network.protocolFamily === "evm";

  /**
   * Resolves decimals, requests quotes and returns them ranked.
   *
   * @param walletProvider - The wallet provider.
   * @param args - Quote arguments.
   * @returns Ranked quotes and destination decimals.
   */
  async #fetchQuotes(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SwapChanQuoteSchema>,
  ): Promise<QuotesResponse & { toDecimals: number }> {
    const chainId = Number(walletProvider.getNetwork().chainId);
    if (!chainId) throw new Error("Chain ID not available from wallet provider");
    const toChainId = args.toChainId ?? chainId;
    const [fromDecimals, toDecimals] = await Promise.all([
      this.#decimals(chainId, args.fromToken),
      this.#decimals(toChainId, args.toToken),
    ]);
    const taker = walletProvider.getAddress();
    const params = new URLSearchParams({
      fromChainId: String(chainId),
      toChainId: String(toChainId),
      fromToken: args.fromToken,
      toToken: args.toToken,
      amount: parseUnits(args.amount, fromDecimals).toString(),
      slippageBps: String(args.slippageBps ?? 50),
      fromAddress: taker,
      toAddress: args.toAddress ?? taker,
    });
    if (this.#partnerId) params.set("partner", this.#partnerId);
    const res = await this.#request<QuotesResponse>(`/quotes?${params}`);
    if (!res.quotes?.length) {
      const why = (res.errors ?? []).map(e => `${e.provider}: ${e.message}`).join("; ");
      throw new Error(`No route found${why ? ` (${why})` : ""}`);
    }
    return { ...res, errors: res.errors ?? [], toDecimals };
  }

  /**
   * Looks up token decimals via the SwapChan token endpoint.
   *
   * @param chainId - Chain id.
   * @param token - Token address.
   * @returns The token's decimals.
   */
  async #decimals(chainId: number, token: string): Promise<number> {
    if (token.toLowerCase() === NATIVE) return 18;
    const t = await this.#request<{ decimals: number }>(
      `/token?chainId=${chainId}&address=${encodeURIComponent(token)}`,
    );
    return t.decimals;
  }

  /**
   * Calls the SwapChan API.
   *
   * @param path - Path including query string.
   * @param body - JSON body for POST requests.
   * @returns The parsed response.
   */
  async #request<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.#apiUrl}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${response.status} ${response.statusText} - ${text}`);
    }
    return (await response.json()) as T;
  }
}

/**
 * Whether a quote is executed by sending a plain EVM transaction.
 *
 * @param q - The quote.
 * @returns True if executable via sendTransaction.
 */
const isTxRoute = (q: SwapChanQuote) => !q.execution || q.execution === "tx";

/**
 * Creates a new SwapChanActionProvider.
 *
 * @param config - Optional configuration for the provider.
 * @returns A new SwapChanActionProvider.
 */
export const swapchanActionProvider = (config: SwapChanActionProviderConfig = {}) =>
  new SwapChanActionProvider(config);
