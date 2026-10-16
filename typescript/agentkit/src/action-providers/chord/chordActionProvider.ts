import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import { EvmWalletProvider } from "../../wallet-providers";
import { Address, encodeFunctionData, erc20Abi, formatUnits, Hex, parseUnits } from "viem";
import { ChordApiClient, ChordApiError, ChordQuoteResponse } from "./api";
import {
  CHORD_API_BASE_URL,
  CHORD_ROUTER_ADDRESS,
  CHORD_SUPPORTED_CHAINS,
  DEFAULT_SLIPPAGE_BPS,
} from "./constants";
import { ChordGetSwapQuoteSchema, ChordSearchTokensSchema, ChordSwapSchema } from "./schemas";
import {
  getBalance,
  getTokenInfo,
  needsApproveReset,
  normalizeToken,
  sanitizeMetadata,
  summarizeQuote,
  TokenInfo,
} from "./utils";

/**
 * Configuration for the ChordActionProvider.
 */
export interface ChordActionProviderConfig {
  /**
   * Optional Chord API key, sent as `X-API-Key`. Quotes and swaps work without one at the public
   * rate limit. Falls back to the `CHORD_API_KEY` environment variable.
   */
  apiKey?: string;

  /**
   * Base URL of the Chord API. Defaults to https://api.getchord.xyz/v1.
   */
  baseUrl?: string;
}

const SUPPORTED_CHAIN_LIST = Object.entries(CHORD_SUPPORTED_CHAINS)
  .map(([id, chain]) => `${chain.name} (${id})`)
  .join(", ");

/**
 * ChordActionProvider quotes and executes token swaps through Chord (https://getchord.xyz), a DEX
 * aggregator that splits orders across venues and settles them through one router contract.
 */
export class ChordActionProvider extends ActionProvider<EvmWalletProvider> {
  readonly #client: ChordApiClient;

  /**
   * Creates a ChordActionProvider.
   *
   * @param config - Optional API key and base URL.
   */
  constructor(config: ChordActionProviderConfig = {}) {
    super("chord", []);
    this.#client = new ChordApiClient({
      baseUrl: config.baseUrl ?? CHORD_API_BASE_URL,
      apiKey: config.apiKey ?? process.env.CHORD_API_KEY,
    });
  }

  /**
   * Searches Chord's token index on the wallet's chain.
   *
   * @param walletProvider - The wallet provider; only its chain is used.
   * @param args - The search query.
   * @returns A JSON string with matching tokens.
   */
  @CreateAction({
    name: "search_tokens",
    description: `
This tool searches Chord's token index on the wallet's current chain by symbol, name or address.

It takes the following input:
- query: A token symbol, name or address fragment, e.g. "USDC"

Important notes:
- Returns up to 10 tokens with address, symbol, name, decimals and a verified flag
- verified: false means the token was found by the index but is not on the chain's curated list; check the address with the user before trading it
- Several tokens can share a symbol. Never guess an address; confirm it with the user when more than one matches
- Supported chains: ${SUPPORTED_CHAIN_LIST}
`,
    schema: ChordSearchTokensSchema,
  })
  async searchTokens(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ChordSearchTokensSchema>,
  ): Promise<string> {
    try {
      const chainId = this.#chainId(walletProvider);
      const tokens = await this.#client.searchTokens({ chainId, query: args.query, limit: 10 });
      return JSON.stringify({
        success: true,
        chainId,
        tokens: tokens.map(token => ({
          address: token.address,
          symbol: sanitizeMetadata(token.symbol),
          name: sanitizeMetadata(token.name),
          decimals: token.decimals,
          verified: token.verified,
          ...(token.tags && token.tags.length > 0 ? { tags: token.tags } : {}),
        })),
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Error searching tokens: ${errorMessage(error)}`,
      });
    }
  }

  /**
   * Gets the best route and expected output for a swap without sending anything.
   *
   * @param walletProvider - The wallet provider; used for its chain and token metadata reads.
   * @param args - Tokens, amount and slippage.
   * @returns A JSON string with the quote.
   */
  @CreateAction({
    name: "get_swap_quote",
    description: `
This tool fetches the best swap route from Chord on the wallet's current chain. It does not send a transaction.

It takes the following inputs:
- fromToken: The address of the token to sell
- toToken: The address of the token to buy
- amount: The amount of fromToken to sell in whole units, e.g. "1.5" for 1.5 ETH or "10" for 10 USDC
- slippageBps: (Optional) Maximum slippage in basis points, default 50 (0.5%)

Important notes:
- The native coin (ETH, BNB, AVAX, MON) is 0x0000000000000000000000000000000000000000. On Arc it stands for USDC
- Use the amount exactly as given in whole units; do not convert it to wei
- expectedAmountOut is what the wallet receives after Chord's fee; minimumAmountOut is the floor the transaction enforces
- Never assume a token address. Token addresses differ between chains; use the search_tokens action or ask the user
- Supported chains: ${SUPPORTED_CHAIN_LIST}
`,
    schema: ChordGetSwapQuoteSchema,
  })
  async getSwapQuote(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ChordGetSwapQuoteSchema>,
  ): Promise<string> {
    try {
      const chainId = this.#chainId(walletProvider);
      const { from, to, amountIn } = await this.#resolve(walletProvider, chainId, args);
      const quote = await this.#client.getQuote({
        chainId,
        inputMint: from.address,
        outputMint: to.address,
        amount: amountIn,
        slippageBps: args.slippageBps ?? DEFAULT_SLIPPAGE_BPS,
      });

      if (!quote.routePlan || quote.routePlan.length === 0) {
        return JSON.stringify(noRoute(quote, from, to, args.amount));
      }

      return JSON.stringify({
        success: true,
        network: CHORD_SUPPORTED_CHAINS[chainId].name,
        chainId,
        ...summarizeQuote(quote, from, to),
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Error fetching quote: ${errorMessage(error)}`,
      });
    }
  }

  /**
   * Swaps tokens through the Chord router: approves the router when needed, builds the transaction
   * with the Chord API, simulates it from the wallet and sends it.
   *
   * @param walletProvider - The wallet provider that signs and sends.
   * @param args - Tokens, amount and slippage.
   * @returns A JSON string with the transaction hash and amounts.
   */
  @CreateAction({
    name: "swap",
    description: `
This tool swaps tokens through the Chord router on the wallet's current chain. It sends real transactions from the wallet.

It takes the following inputs:
- fromToken: The address of the token to sell
- toToken: The address of the token to buy
- amount: The amount of fromToken to sell in whole units, e.g. "1.5" for 1.5 ETH or "10" for 10 USDC
- slippageBps: (Optional) Maximum slippage in basis points, default 50 (0.5%)

Important notes:
- Get a quote with get_swap_quote first, show it to the user and only swap once they confirm
- The native coin (ETH, BNB, AVAX, MON) is 0x0000000000000000000000000000000000000000. On Arc it stands for USDC
- For an ERC-20 input the tool first sends an approval for exactly the swap amount to the Chord router (${CHORD_ROUTER_ADDRESS}) if the current allowance is too low
- The swap transaction is simulated from the wallet before it is sent; it is not sent if the simulation fails
- Use the amount exactly as given in whole units; do not convert it to wei
- Never assume a token address; use the search_tokens action or ask the user
- Supported chains: ${SUPPORTED_CHAIN_LIST}
`,
    schema: ChordSwapSchema,
  })
  async swap(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof ChordSwapSchema>,
  ): Promise<string> {
    let approvalTxHash: Hex | undefined;
    try {
      const chainId = this.#chainId(walletProvider);
      const walletAddress = walletProvider.getAddress() as Address;
      const { from, to, amountIn } = await this.#resolve(walletProvider, chainId, args);

      const balance = await getBalance(walletProvider, from);
      if (balance < amountIn) {
        return JSON.stringify({
          success: false,
          error: `Insufficient ${from.symbol} balance: have ${formatUnits(balance, from.decimals)}, need ${args.amount}`,
        });
      }

      const slippageBps = args.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
      const quoteParams = {
        chainId,
        inputMint: from.address,
        outputMint: to.address,
        amount: amountIn,
        slippageBps,
      };
      let quote = await this.#client.getQuote(quoteParams);
      if (!quote.routePlan || quote.routePlan.length === 0) {
        return JSON.stringify(noRoute(quote, from, to, args.amount));
      }

      if (!from.isNative) {
        const approval = await this.#ensureAllowance(walletProvider, chainId, from, amountIn);
        if (!approval.success) {
          return JSON.stringify({ success: false, error: approval.error, ...approval.hashes });
        }
        approvalTxHash = approval.hashes.approvalTxHash;
        if (approvalTxHash) {
          // Waiting for the approval can outlast the quote's validity, so quote again.
          quote = await this.#client.getQuote(quoteParams);
          if (!quote.routePlan || quote.routePlan.length === 0) {
            return JSON.stringify({ ...noRoute(quote, from, to, args.amount), approvalTxHash });
          }
        }
      }

      const built = await this.#client.buildSwap({
        chainId,
        quote,
        userAddress: walletAddress,
        slippageBps,
      });
      const tx = built.transaction;
      if (tx.to.toLowerCase() !== CHORD_ROUTER_ADDRESS) {
        throw new Error(`Refusing transaction to ${tx.to}: expected the Chord router`);
      }
      if (Number(tx.chainId) !== chainId) {
        throw new Error(`Refusing transaction for chain ${tx.chainId}: wallet is on ${chainId}`);
      }

      const simulation = await this.#client.simulate({
        chainId,
        from: walletAddress,
        to: tx.to,
        data: tx.data,
        value: tx.value,
      });
      if (!simulation.ok) {
        return JSON.stringify({
          success: false,
          error: `Swap simulation failed: ${simulation.revert ?? "reverted"}${simulation.selector ? ` (${simulation.selector})` : ""}`,
          ...(approvalTxHash ? { approvalTxHash } : {}),
        });
      }

      const outBefore = to.isNative ? null : await getBalance(walletProvider, to);

      // Gas is left to the wallet provider, which estimates it against the current state.
      const hash = await walletProvider.sendTransaction({
        to: tx.to as Address,
        data: tx.data as Hex,
        value: BigInt(tx.value || "0"),
      });
      const receipt = await walletProvider.waitForTransactionReceipt(hash);
      if (receipt?.status !== "success" && receipt?.status !== "complete") {
        return JSON.stringify({
          success: false,
          error: "Swap transaction reverted",
          transactionHash: hash,
          ...(approvalTxHash ? { approvalTxHash } : {}),
        });
      }

      const summary = summarizeQuote(quote, from, to);
      let amountReceived: string | null = null;
      if (outBefore !== null) {
        const outAfter = await getBalance(walletProvider, to);
        amountReceived = formatUnits(outAfter - outBefore, to.decimals);
      }

      return JSON.stringify({
        success: true,
        network: CHORD_SUPPORTED_CHAINS[chainId].name,
        chainId,
        transactionHash: hash,
        ...(approvalTxHash ? { approvalTxHash } : {}),
        fromToken: summary.fromToken,
        toToken: summary.toToken,
        expectedAmountOut: summary.expectedAmountOut,
        minimumAmountOut: summary.minimumAmountOut,
        ...(amountReceived !== null ? { amountReceived } : {}),
        route: summary.route,
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: `Error swapping tokens: ${errorMessage(error)}`,
        ...(approvalTxHash ? { approvalTxHash } : {}),
      });
    }
  }

  /**
   * Checks whether the wallet's network is one the Chord router is deployed on.
   *
   * @param network - The network to check.
   * @returns True for the supported EVM chains.
   */
  supportsNetwork = (network: Network): boolean =>
    network.protocolFamily === "evm" &&
    network.chainId !== undefined &&
    Number(network.chainId) in CHORD_SUPPORTED_CHAINS;

  /**
   * Returns the wallet's chain id, or throws when Chord does not support it.
   *
   * @param walletProvider - The wallet provider.
   * @returns The chain id.
   */
  #chainId(walletProvider: EvmWalletProvider): number {
    const chainId = Number(walletProvider.getNetwork().chainId);
    if (!CHORD_SUPPORTED_CHAINS[chainId]) {
      throw new Error(`Chain ${chainId} is not supported by Chord`);
    }
    return chainId;
  }

  /**
   * Resolves token details and the input amount in the smallest unit.
   *
   * @param walletProvider - The wallet provider.
   * @param chainId - The chain id.
   * @param args - Action arguments.
   * @param args.fromToken - Token sold.
   * @param args.toToken - Token bought.
   * @param args.amount - Amount sold in whole units.
   * @returns Input and output token details and the raw input amount.
   */
  async #resolve(
    walletProvider: EvmWalletProvider,
    chainId: number,
    args: { fromToken: string; toToken: string; amount: string },
  ): Promise<{ from: TokenInfo; to: TokenInfo; amountIn: bigint }> {
    const fromAddress = normalizeToken(chainId, args.fromToken);
    const toAddress = normalizeToken(chainId, args.toToken);
    if (fromAddress === toAddress) {
      throw new Error("fromToken and toToken are the same token");
    }
    const [from, to] = await Promise.all([
      getTokenInfo(walletProvider, chainId, fromAddress),
      getTokenInfo(walletProvider, chainId, toAddress),
    ]);
    const amountIn = parseUnits(args.amount, from.decimals);
    if (amountIn <= 0n) {
      throw new Error("amount must be greater than zero");
    }
    return { from, to, amountIn };
  }

  /**
   * Approves the Chord router for the input amount when the current allowance is lower.
   *
   * @param walletProvider - The wallet provider.
   * @param chainId - The chain id.
   * @param token - The ERC-20 token sold.
   * @param amount - Amount the router must be allowed to pull.
   * @returns Success, the hashes of any approval transactions, or the failure reason.
   */
  async #ensureAllowance(
    walletProvider: EvmWalletProvider,
    chainId: number,
    token: TokenInfo,
    amount: bigint,
  ): Promise<{ success: boolean; error?: string; hashes: { approvalTxHash?: Hex } }> {
    const allowance = (await walletProvider.readContract({
      address: token.address,
      abi: erc20Abi,
      functionName: "allowance",
      args: [walletProvider.getAddress() as Address, CHORD_ROUTER_ADDRESS],
    })) as bigint;
    if (allowance >= amount) {
      return { success: true, hashes: {} };
    }

    if (allowance > 0n && needsApproveReset(chainId, token.address)) {
      const resetHash = await walletProvider.sendTransaction({
        to: token.address,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [CHORD_ROUTER_ADDRESS, 0n],
        }),
      });
      const resetReceipt = await walletProvider.waitForTransactionReceipt(resetHash);
      if (resetReceipt?.status !== "success" && resetReceipt?.status !== "complete") {
        return {
          success: false,
          error: "Allowance reset transaction reverted",
          hashes: { approvalTxHash: resetHash },
        };
      }
    }

    const approvalTxHash = await walletProvider.sendTransaction({
      to: token.address,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [CHORD_ROUTER_ADDRESS, amount],
      }),
    });
    const receipt = await walletProvider.waitForTransactionReceipt(approvalTxHash);
    if (receipt?.status !== "success" && receipt?.status !== "complete") {
      return { success: false, error: "Approval transaction reverted", hashes: { approvalTxHash } };
    }
    return { success: true, hashes: { approvalTxHash } };
  }
}

/**
 * Builds the answer for a quote without a route.
 *
 * @param quote - The `/quote` body.
 * @param from - Input token details.
 * @param to - Output token details.
 * @param amount - Amount requested, whole units.
 * @returns A failure object naming the reason.
 */
function noRoute(
  quote: ChordQuoteResponse,
  from: TokenInfo,
  to: TokenInfo,
  amount: string,
): Record<string, unknown> {
  const reason = quote.noRouteReason ?? "NO_ROUTE";
  const hint =
    reason === "INSUFFICIENT_LIQUIDITY" ? " Try a smaller amount." : " No pool connects them.";
  return {
    success: false,
    noRouteReason: reason,
    error: `No route to swap ${amount} ${from.symbol} for ${to.symbol}.${hint}`,
  };
}

/**
 * Formats an error for the agent.
 *
 * @param error - Any thrown value.
 * @returns A short message.
 */
function errorMessage(error: unknown): string {
  if (error instanceof ChordApiError)
    return `${error.code} (HTTP ${error.status}): ${error.message}`;
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Creates a ChordActionProvider.
 *
 * @param config - Optional API key and base URL.
 * @returns A new ChordActionProvider.
 */
export const chordActionProvider = (config: ChordActionProviderConfig = {}) =>
  new ChordActionProvider(config);
