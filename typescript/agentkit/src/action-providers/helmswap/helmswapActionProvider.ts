/**
 * HelmSwap Action Provider
 *
 * Quotes and executes token swaps on EVM networks using HelmSwap's public API.
 * HelmSwap returns unsigned transactions; the agent's own wallet provider signs and sends them.
 *
 * @module helmswap
 */

import { z } from "zod";
import { Hex, erc20Abi, formatUnits, parseUnits } from "viem";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { HelmswapQuoteSchema, HelmswapSwapSchema } from "./schemas";

export const HELMSWAP_API_URL = "https://helmswap.com";

/** EVM chain ids where HelmSwap can build swap transactions. */
export const HELMSWAP_SUPPORTED_CHAIN_IDS = [
  "1",
  "56",
  "999",
  "4663",
  "5042",
  "8453",
  "57073",
  "99901",
];

const DEFAULT_SLIPPAGE_BPS = 50;
const NATIVE_TOKEN = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

/**
 * Configuration options for the HelmswapActionProvider.
 */
export interface HelmswapActionProviderConfig {
  /**
   * Override the HelmSwap API base URL. Defaults to https://helmswap.com.
   */
  baseUrl?: string;
}

type UnsignedTx = { to: string; data: string; value?: string };

/**
 * HelmswapActionProvider provides actions to quote and execute swaps with HelmSwap.
 */
export class HelmswapActionProvider extends ActionProvider<EvmWalletProvider> {
  readonly #baseUrl: string;

  /**
   * Constructor for the HelmswapActionProvider.
   *
   * @param config - Optional configuration
   */
  constructor(config: HelmswapActionProviderConfig = {}) {
    super("helmswap", []);
    this.#baseUrl = (config.baseUrl ?? HELMSWAP_API_URL).replace(/\/$/, "");
  }

  /**
   * Gets a swap quote from HelmSwap.
   *
   * @param walletProvider - The wallet provider to get the network and token details from
   * @param args - The quote parameters
   * @returns A JSON string with the quote details or an error
   */
  @CreateAction({
    name: "get_swap_quote_from_helmswap",
    description: `
This tool gets a swap quote from HelmSwap on the current EVM network without executing anything.

It takes the following inputs:
- sellToken: The contract address of the token to sell
- buyToken: The contract address of the token to buy
- sellAmount: The amount of sellToken in whole units (e.g. 1 ETH or 10 USDC)
- slippageBps: (Optional) Maximum allowed slippage in basis points (default 50, max 1000)

Important notes:
- The address for the native asset is "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
- The quote includes a disclosed fee, the expected output, the minimum output after slippage and the price impact
- Use sellToken units exactly as provided, do not convert to wei or any other units
- Never assume token or address, they have to be provided as inputs
`,
    schema: HelmswapQuoteSchema,
  })
  async getSwapQuote(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof HelmswapQuoteSchema>,
  ): Promise<string> {
    try {
      const chainId = this.getChainId(walletProvider);
      const [sellDecimals, buyDecimals] = await Promise.all([
        this.getDecimals(walletProvider, args.sellToken),
        this.getDecimals(walletProvider, args.buyToken),
      ]);
      const amountIn = parseUnits(args.sellAmount, sellDecimals).toString();

      const quote = await this.fetchQuote(chainId, args, amountIn);

      return JSON.stringify({
        success: true,
        sellToken: args.sellToken,
        buyToken: args.buyToken,
        sellAmount: args.sellAmount,
        buyAmount: formatUnits(BigInt(quote.quote.netOutAmount), buyDecimals),
        minBuyAmount: formatUnits(BigInt(quote.quote.minOutNet), buyDecimals),
        priceImpactPct: quote.priceImpact?.priceImpactPct ?? null,
        buildable: quote.priceImpact?.buildable ?? true,
        fee: quote.quote.fee ?? null,
        warnings: quote.warnings ?? [],
        slippageBps: args.slippageBps ?? DEFAULT_SLIPPAGE_BPS,
        network: walletProvider.getNetwork().networkId,
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: `Error fetching HelmSwap quote: ${error}` });
    }
  }

  /**
   * Executes a swap through HelmSwap.
   *
   * @param walletProvider - The wallet provider used to sign and send the transactions
   * @param args - The swap parameters
   * @returns A JSON string with the transaction details or an error
   */
  @CreateAction({
    name: "execute_swap_on_helmswap",
    description: `
This tool executes a token swap on the current EVM network using HelmSwap.

It takes the following inputs:
- sellToken: The contract address of the token to sell
- buyToken: The contract address of the token to buy
- sellAmount: The amount of sellToken in whole units (e.g. 1 ETH or 10 USDC)
- slippageBps: (Optional) Maximum allowed slippage in basis points (default 50, max 1000)

Important notes:
- The address for the native asset is "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"
- This will execute an actual swap transaction that sends tokens from your wallet
- HelmSwap builds the unsigned transaction; your wallet signs and sends it. A disclosed fee is included in the quote.
- When selling an ERC-20 token, an approval for the exact sell amount is sent first
- Ensure you have sufficient balance of the sell token before executing
- First fetch a quote and only execute the swap if you are happy with the indicated price
- Use sellToken units exactly as provided, do not convert to wei or any other units
- Never assume token or address, they have to be provided as inputs
`,
    schema: HelmswapSwapSchema,
  })
  async executeSwap(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof HelmswapSwapSchema>,
  ): Promise<string> {
    const approvalTxHashes: Hex[] = [];
    try {
      const chainId = this.getChainId(walletProvider);
      const [sellDecimals, buyDecimals] = await Promise.all([
        this.getDecimals(walletProvider, args.sellToken),
        this.getDecimals(walletProvider, args.buyToken),
      ]);
      const amountIn = parseUnits(args.sellAmount, sellDecimals).toString();

      const quote = await this.fetchQuote(chainId, args, amountIn);
      if (quote.priceImpact?.buildable === false) {
        return JSON.stringify({
          success: false,
          error: `HelmSwap will not build this swap because the price impact is too high (${quote.priceImpact.priceImpactPct}%). Try a smaller amount.`,
        });
      }

      const built = await this.request("/api/v1/build-tx", {
        method: "POST",
        body: JSON.stringify({
          chainId: Number(chainId),
          tokenIn: args.sellToken,
          tokenOut: args.buyToken,
          amountIn,
          recipient: walletProvider.getAddress(),
          quoteTicket: quote.quoteTicket,
          slippageBps: args.slippageBps ?? DEFAULT_SLIPPAGE_BPS,
        }),
      });

      for (const approval of (built.approvals ?? []) as UnsignedTx[]) {
        const hash = await walletProvider.sendTransaction(toTxParams(approval));
        await walletProvider.waitForTransactionReceipt(hash);
        approvalTxHashes.push(hash);
      }

      const txHash = await walletProvider.sendTransaction(toTxParams(built.tx as UnsignedTx));
      const receipt = await walletProvider.waitForTransactionReceipt(txHash);
      if (receipt.status !== "complete" && receipt.status !== "success") {
        return JSON.stringify({
          success: false,
          approvalTxHashes,
          transactionHash: receipt.transactionHash ?? txHash,
          error: "Swap transaction failed",
        });
      }

      return JSON.stringify({
        success: true,
        approvalTxHashes,
        transactionHash: receipt.transactionHash ?? txHash,
        sellToken: args.sellToken,
        buyToken: args.buyToken,
        sellAmount: args.sellAmount,
        expectedBuyAmount: formatUnits(BigInt(quote.quote.netOutAmount), buyDecimals),
        minBuyAmount: formatUnits(BigInt(quote.quote.minOutNet), buyDecimals),
        fee: built.fee ?? quote.quote.fee ?? null,
        slippageBps: args.slippageBps ?? DEFAULT_SLIPPAGE_BPS,
        network: walletProvider.getNetwork().networkId,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Error executing HelmSwap swap: ${error}`,
        ...(approvalTxHashes.length ? { approvalTxHashes } : {}),
      });
    }
  }

  /**
   * Checks if the HelmSwap action provider supports the given network.
   *
   * @param network - The network to check
   * @returns True if HelmSwap can build swaps on the network
   */
  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" &&
    network.chainId !== undefined &&
    HELMSWAP_SUPPORTED_CHAIN_IDS.includes(network.chainId);

  /**
   * Reads the chain id from the wallet provider.
   *
   * @param walletProvider - The wallet provider
   * @returns The chain id as a string
   */
  private getChainId(walletProvider: EvmWalletProvider): string {
    const chainId = walletProvider.getNetwork().chainId;
    if (!chainId) throw new Error("Chain ID not available from wallet provider");
    return chainId;
  }

  /**
   * Reads token decimals, treating the native asset as 18 decimals.
   *
   * @param walletProvider - The wallet provider used to read the token contract
   * @param token - The token address
   * @returns The token decimals
   */
  private async getDecimals(walletProvider: EvmWalletProvider, token: string): Promise<number> {
    if (token.toLowerCase() === NATIVE_TOKEN) return 18;
    const decimals = await walletProvider.readContract({
      address: token as Hex,
      abi: erc20Abi,
      functionName: "decimals",
    });
    return Number(decimals);
  }

  /**
   * Fetches a quote from the HelmSwap API.
   *
   * @param chainId - The chain id
   * @param args - The quote parameters
   * @param amountIn - The sell amount in base units
   * @returns The quote response
   */
  private async fetchQuote(
    chainId: string,
    args: z.infer<typeof HelmswapQuoteSchema>,
    amountIn: string,
  ) {
    const params = new URLSearchParams({
      chainId,
      tokenIn: args.sellToken,
      tokenOut: args.buyToken,
      amountIn,
      slippageBps: (args.slippageBps ?? DEFAULT_SLIPPAGE_BPS).toString(),
    });
    return this.request(`/api/v1/quote?${params.toString()}`, { method: "GET" });
  }

  /**
   * Sends a request to the HelmSwap API.
   *
   * @param path - The API path
   * @param init - Fetch options
   * @returns The parsed JSON response
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async request(path: string, init: RequestInit): Promise<any> {
    const response = await fetch(`${this.#baseUrl}${path}`, {
      ...init,
      headers: { accept: "application/json", "content-type": "application/json" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    try {
      data = await response.json();
    } catch {
      throw new Error(`HelmSwap returned a non-JSON response (${response.status})`);
    }
    if (!response.ok || data?.ok === false) {
      const code = data?.code ? ` ${data.code}` : "";
      throw new Error(`${response.status}${code}: ${data?.error ?? "HelmSwap request failed"}`);
    }
    return data;
  }
}

/**
 * Converts an unsigned HelmSwap transaction into wallet provider transaction params.
 *
 * @param tx - The unsigned transaction
 * @returns The transaction params
 */
function toTxParams(tx: UnsignedTx) {
  return {
    to: tx.to as Hex,
    data: tx.data as Hex,
    ...(tx.value && tx.value !== "0" ? { value: BigInt(tx.value) } : {}),
  };
}

/**
 * Factory function to create a new HelmswapActionProvider instance.
 *
 * @param config - Optional configuration
 * @returns A new HelmswapActionProvider instance
 */
export const helmswapActionProvider = (config?: HelmswapActionProviderConfig) =>
  new HelmswapActionProvider(config);
