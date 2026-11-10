import { z } from "zod";
import { erc20Abi, formatUnits, getAddress, isAddress, parseUnits } from "viem";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { Network } from "../../network";
import {
  BuyIndexSchema,
  GetIndexSchema,
  GetPortfolioSchema,
  ListIndexesSchema,
  SellIndexSchema,
} from "./schemas";
import {
  BASE_CHAIN_ID,
  INDEX_SHARE_DECIMALS,
  INDEXFY_API_URL,
  INDEXFY_ZAPPER_BASE,
  SHARE_ROUNDING_DUST,
  USDC_BASE,
} from "./constants";
import { BuiltTransaction, IndexInfo, IndexfyToolError, callIndexfyTool } from "./utils";

/**
 * Configuration options for the IndexfyActionProvider.
 */
export interface IndexfyActionProviderConfig {
  /**
   * Indexfy MCP endpoint. Defaults to https://api.indexfy.xyz/mcp.
   */
  apiUrl?: string;

  /**
   * Contracts the provider may send transactions to, besides the index token itself. Every call the
   * API returns is checked against this list before signing. Defaults to Base USDC and the
   * IndexfyZapper.
   */
  allowedTargets?: string[];
}

/**
 * IndexfyActionProvider lets an agent research, buy and sell Indexfy crypto index tokens on Base
 * (e.g. I5: a BTC/ETH/XRP/SOL/BNB basket). Each index is an ERC-20 fully backed by its basket; buys
 * and sells are one USDC transaction that mints or redeems at basket value.
 *
 * Transactions are built and simulated by the public Indexfy API, checked here against the chain,
 * the wallet and a contract allow-list, then signed and sent by the agent's own wallet.
 */
export class IndexfyActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly apiUrl: string;
  private readonly allowedTargets: Set<string>;

  /**
   * Constructor for the IndexfyActionProvider class.
   *
   * @param config - Optional API URL and contract allow-list overrides
   */
  constructor(config: IndexfyActionProviderConfig = {}) {
    super("indexfy", []);
    this.apiUrl = config.apiUrl ?? INDEXFY_API_URL;
    this.allowedTargets = new Set(
      (config.allowedTargets ?? [USDC_BASE, INDEXFY_ZAPPER_BASE]).map(a => a.toLowerCase()),
    );
  }

  /**
   * Lists Indexfy indexes with price, TVL, performance and fees.
   *
   * @param args - Sort order and number of indexes
   * @returns A JSON string with the indexes, or an error
   */
  @CreateAction({
    name: "list_indexes",
    description: `
Lists Indexfy crypto index tokens on Base with price, TVL, 24h/7d performance and fees.
Each index is an ERC-20 fully backed by a basket of tokens (e.g. I5 = BTC 30%, ETH 30%, XRP 18%, SOL 14%, BNB 8%).
Use this to discover indexes or to find an index's address or ticker before buying.`,
    schema: ListIndexesSchema,
  })
  async listIndexes(args: z.infer<typeof ListIndexesSchema>): Promise<string> {
    return this.read("list_indexes", { sort: args.sort, limit: args.limit });
  }

  /**
   * Gets one index's stats, mandate and holdings.
   *
   * @param args - The index address or ticker
   * @returns A JSON string with the index details, or an error
   */
  @CreateAction({
    name: "get_index",
    description: `
Gets one Indexfy index's stats, mandate and current holdings (each basket token's amount, USD value and weight).
Accepts the index's token address or its ticker, e.g. "I5".`,
    schema: GetIndexSchema,
  })
  async getIndex(args: z.infer<typeof GetIndexSchema>): Promise<string> {
    try {
      const index = await this.resolveIndex(args.index);
      return await this.read("get_index", { address: index.address });
    } catch (error) {
      return fail(error);
    }
  }

  /**
   * Gets a wallet's index positions, defaulting to the agent's wallet.
   *
   * @param walletProvider - The agent's wallet provider
   * @param args - Optional wallet to look up
   * @returns A JSON string with the positions, or an error
   */
  @CreateAction({
    name: "get_portfolio",
    description: `
Gets a wallet's Indexfy index positions with value and profit/loss, plus its Indexfy points.
Defaults to the agent's own wallet.`,
    schema: GetPortfolioSchema,
  })
  async getPortfolio(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof GetPortfolioSchema>,
  ): Promise<string> {
    return this.read("get_wallet_portfolio", {
      wallet: args.wallet ?? walletProvider.getAddress(),
    });
  }

  /**
   * Buys an index with USDC.
   *
   * @param walletProvider - The agent's wallet provider
   * @param args - The index and the maximum USDC to spend
   * @returns A JSON string with the trade summary and transaction hashes, or an error
   */
  @CreateAction({
    name: "buy_index",
    description: `
Buys an Indexfy index token with USDC on Base. One transaction buys every basket token and mints index shares at basket value,
reverting if fewer than the quoted minimum shares would be received. Unspent USDC is refunded.
Inputs:
- index: the index's token address or ticker, e.g. "I5"
- usdcAmount: maximum USDC to spend, in whole USDC, e.g. "25"
The wallet needs the USDC on Base plus a little ETH for gas. An approval transaction may be sent first.`,
    schema: BuyIndexSchema,
  })
  async buyIndex(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof BuyIndexSchema>,
  ): Promise<string> {
    try {
      const index = await this.resolveIndex(args.index);
      const built = await callIndexfyTool<BuiltTransaction>(this.apiUrl, "build_buy_index", {
        wallet: walletProvider.getAddress(),
        index: index.address,
        usdcAmount: args.usdcAmount,
      });
      return await this.execute(walletProvider, built, index);
    } catch (error) {
      return fail(error);
    }
  }

  /**
   * Sells index shares for USDC.
   *
   * @param walletProvider - The agent's wallet provider
   * @param args - The index and the shares to sell, or "all"
   * @returns A JSON string with the trade summary and transaction hashes, or an error
   */
  @CreateAction({
    name: "sell_index",
    description: `
Sells Indexfy index shares for USDC on Base. One transaction redeems the shares for the basket and sells each token for USDC,
reverting if less than the quoted minimum USDC would be received.
Inputs:
- index: the index's token address or ticker, e.g. "I5"
- shares: shares to sell in whole shares, e.g. "12.5", or "all" for the whole position
An approval transaction may be sent first.`,
    schema: SellIndexSchema,
  })
  async sellIndex(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof SellIndexSchema>,
  ): Promise<string> {
    try {
      const index = await this.resolveIndex(args.index);
      const balance = await walletProvider.readContract({
        address: index.address as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [walletProvider.getAddress() as `0x${string}`],
      });
      if (balance === BigInt(0)) return fail(`This wallet holds no ${index.symbol}.`);
      let shares = args.shares;
      if (shares === "all") {
        shares = formatUnits(balance, INDEX_SHARE_DECIMALS);
      } else {
        // Agents often pass a rounded balance copied from get_portfolio; sell the exact balance instead.
        const wanted = parseUnits(shares, INDEX_SHARE_DECIMALS);
        if (wanted > balance && wanted - balance <= SHARE_ROUNDING_DUST) {
          shares = formatUnits(balance, INDEX_SHARE_DECIMALS);
        }
      }
      const built = await callIndexfyTool<BuiltTransaction>(this.apiUrl, "build_sell_index", {
        wallet: walletProvider.getAddress(),
        index: index.address,
        shares,
      });
      return await this.execute(walletProvider, built, index);
    } catch (error) {
      return fail(error);
    }
  }

  /**
   * Checks if the action provider supports the given network. Indexfy is on Base mainnet only.
   *
   * @param network - The network to check
   * @returns True for Base mainnet
   */
  supportsNetwork = (network: Network): boolean =>
    network.protocolFamily === "evm" &&
    (network.networkId === "base-mainnet" || network.chainId === String(BASE_CHAIN_ID));

  /**
   * Calls a read-only tool and wraps its result.
   *
   * @param tool - The tool name
   * @param args - The tool arguments
   * @returns A JSON string with the result, or an error
   */
  private async read(tool: string, args: Record<string, unknown>): Promise<string> {
    try {
      const data = await callIndexfyTool(this.apiUrl, tool, args);
      return JSON.stringify({
        success: true,
        ...(typeof data === "object" ? data : { result: data }),
      });
    } catch (error) {
      return fail(error);
    }
  }

  /**
   * Resolves an index address or ticker to the index's address, name and symbol.
   *
   * @param ref - The index address or ticker, e.g. "I5"
   * @returns The index
   */
  private async resolveIndex(ref: string): Promise<IndexInfo> {
    const { indexes } = await callIndexfyTool<{ indexes: IndexInfo[] }>(
      this.apiUrl,
      "list_indexes",
      { sort: "tvl", limit: 50 },
    );
    const wanted = ref.trim().toLowerCase();
    const match = isAddress(ref)
      ? indexes.find(i => i.address.toLowerCase() === wanted)
      : indexes.find(i => i.symbol.toLowerCase() === wanted);
    if (match) return { ...match, address: getAddress(match.address) };
    if (isAddress(ref)) {
      // Not in the top 50 by TVL: let the API validate it.
      return { address: getAddress(ref), name: ref, symbol: ref };
    }
    throw new IndexfyToolError(
      `No Indexfy index with ticker "${ref}". Available: ${indexes.map(i => i.symbol).join(", ")}`,
    );
  }

  /**
   * Checks the built calls, then sends them in order, each after the previous one confirms.
   *
   * @param walletProvider - The agent's wallet provider
   * @param built - The calls returned by a build tool
   * @param index - The index being traded
   * @returns A JSON string with the trade summary and transaction hashes, or an error
   */
  private async execute(
    walletProvider: EvmWalletProvider,
    built: BuiltTransaction,
    index: IndexInfo,
  ): Promise<string> {
    if (built.chainId !== BASE_CHAIN_ID) {
      return fail(
        `Refusing to send: API built for chain ${built.chainId}, expected Base (${BASE_CHAIN_ID}).`,
      );
    }
    if (built.from.toLowerCase() !== walletProvider.getAddress().toLowerCase()) {
      return fail(`Refusing to send: API built for ${built.from}, not this wallet.`);
    }
    const allowed = new Set([...this.allowedTargets, index.address.toLowerCase()]);
    const unexpected = built.calls.find(c => !allowed.has(c.to.toLowerCase()));
    if (unexpected) {
      return fail(
        `Refusing to send: unexpected contract ${unexpected.to} (${unexpected.description}).`,
      );
    }
    if (built.simulation?.status === "reverted") {
      const reason = built.simulation.error ?? built.simulation.reason ?? "unknown reason";
      return fail(`The transaction would revert: ${reason}`);
    }

    const transactions: { description: string; hash: string }[] = [];
    for (const call of built.calls) {
      const hash = await walletProvider.sendTransaction({
        to: call.to,
        data: call.data,
        value: BigInt(call.value || "0"),
      });
      const receipt = await walletProvider.waitForTransactionReceipt(hash);
      transactions.push({ description: call.description, hash });
      if (receipt?.status !== "success" && receipt?.status !== "complete") {
        return JSON.stringify({
          success: false,
          error: `Transaction failed: ${call.description}. Swap routes go stale within minutes; try again to rebuild.`,
          transactions,
        });
      }
    }

    return JSON.stringify({ success: true, summary: built.summary, transactions });
  }
}

/**
 * Formats an error as the provider's JSON error result.
 *
 * @param error - The error or message
 * @returns A JSON string with success false and the message
 */
function fail(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return JSON.stringify({ success: false, error: message });
}

export const indexfyActionProvider = (config?: IndexfyActionProviderConfig) =>
  new IndexfyActionProvider(config);
