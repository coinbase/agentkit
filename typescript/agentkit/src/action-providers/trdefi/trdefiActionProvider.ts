import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { GetQuoteSchema, GetStrategySchema, ListStrategiesSchema } from "./schemas";
import { TRDEFI_API_BASE_URL } from "./constants";

/**
 * TrdefiActionProvider is an action provider for TRDEFI API interactions.
 * Provides functionality to list chains, catalogue stats, open liquidity
 * strategies, strategy details, and on-chain swap quotes.
 *
 * TRDEFI is a non-custodial stablecoin liquidity venue: every action here is
 * read-only. Funds never leave the holder's wallet; positions are backed by
 * bounded, revocable allowances rather than deposits.
 */
export class TrdefiActionProvider extends ActionProvider {
  /**
   * Constructor for the TrdefiActionProvider class.
   */
  constructor() {
    super("trdefi", []);
  }

  /**
   * Lists the chains in the TRDEFI catalogue.
   *
   * @returns A JSON string containing the supported chains with their
   * registries, engines, and tokens
   */
  @CreateAction({
    name: "list_chains",
    description: `This tool will list the blockchains in the TRDEFI liquidity catalogue.

Important notes:
- Takes no inputs
- Returns chain keys, names, chain IDs, explorers, registry and engine
  contract addresses, and the tracked tokens per chain
- Use a chain key from this list for the other TRDEFI actions`,
    schema: z.object({}).strict(),
  })
  async listChains(): Promise<string> {
    try {
      const response = await fetch(`${TRDEFI_API_BASE_URL}/api/chains`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error: unknown) {
      return `Error listing chains: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Gets aggregate TRDEFI catalogue stats.
   *
   * @returns A JSON string containing strategy/maker/pair totals and volume
   */
  @CreateAction({
    name: "get_stats",
    description: `This tool will fetch aggregate TRDEFI catalogue statistics.

Important notes:
- Takes no inputs
- Returns strategy, maker and pair totals plus 1d/7d/30d volume in USD`,
    schema: z.object({}).strict(),
  })
  async getStats(): Promise<string> {
    try {
      const response = await fetch(`${TRDEFI_API_BASE_URL}/api/stats`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error: unknown) {
      return `Error fetching stats: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Lists open TRDEFI liquidity strategies on a chain.
   *
   * @param args - The chain and optional filters
   * @returns A JSON string containing matching strategies
   */
  @CreateAction({
    name: "list_strategies",
    description: `This tool will list open non-custodial stablecoin liquidity strategies in the TRDEFI catalogue.
It takes the following inputs:
- A chain key (ethereum, base, arbitrum, optimism, polygon)
- Optional free-text search over pairs and makers
- Optional pair filter, e.g. 'USDC/USDT'

Important notes:
- Each strategy carries a strategy_hash used by get_strategy and get_quote
- Returns an empty strategies array (not an error) when nothing matches`,
    schema: ListStrategiesSchema,
  })
  async listStrategies(args: z.infer<typeof ListStrategiesSchema>): Promise<string> {
    try {
      const params = new URLSearchParams({ chain: args.chain });
      if (args.q) {
        params.set("q", args.q);
      }
      if (args.pair) {
        params.set("pair", args.pair);
      }

      const response = await fetch(`${TRDEFI_API_BASE_URL}/api/strategies?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error: unknown) {
      return `Error listing strategies: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Gets a single TRDEFI strategy by hash.
   *
   * @param args - The strategy hash
   * @returns A JSON string containing the strategy detail
   */
  @CreateAction({
    name: "get_strategy",
    description: `This tool will fetch a single TRDEFI liquidity strategy by its hash.
It takes the following inputs:
- The strategy hash (0x...), as returned by list_strategies

Important notes:
- Returns chain, pair, tokens, status, volume, and activity for the strategy`,
    schema: GetStrategySchema,
  })
  async getStrategy(args: z.infer<typeof GetStrategySchema>): Promise<string> {
    try {
      const params = new URLSearchParams({ hash: args.hash });
      const response = await fetch(
        `${TRDEFI_API_BASE_URL}/api/strategy-detail?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error: unknown) {
      return `Error fetching strategy: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Quotes a swap against a TRDEFI strategy at the current block.
   *
   * @param args - The strategy hash, chain, amount, and direction
   * @returns A JSON string containing the quote, or a structured reason when
   * the strategy cannot be quoted (e.g. gated, unverified pair)
   */
  @CreateAction({
    name: "get_quote",
    description: `This tool will quote a swap against a TRDEFI strategy at the current block.
It takes the following inputs:
- The strategy hash (0x...), as returned by list_strategies
- A chain key (ethereum, base, arbitrum, optimism, polygon)
- The input amount in the token's base units, e.g. '1000000'
- The swap direction: 'aToB' or 'bToA'

Important notes:
- The quote is a read-only simulation; it moves no funds
- Some strategies cannot be quoted (gated makers, unverified pairs). That is
  returned as a structured reason, not an error — pick another strategy`,
    schema: GetQuoteSchema,
  })
  async getQuote(args: z.infer<typeof GetQuoteSchema>): Promise<string> {
    try {
      const params = new URLSearchParams({
        hash: args.hash,
        chain: args.chain,
        amount: args.amount,
        direction: args.direction,
      });
      const response = await fetch(`${TRDEFI_API_BASE_URL}/api/quote?${params.toString()}`);

      const data = await response.json();
      return JSON.stringify(data, null, 2);
    } catch (error: unknown) {
      return `Error quoting swap: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Checks if the TRDEFI action provider supports the given network.
   * TRDEFI is network-agnostic, so this always returns true.
   *
   * @returns True, as TRDEFI actions are supported on all networks.
   */
  supportsNetwork(): boolean {
    return true;
  }
}

/**
 * Creates a new instance of the TrdefiActionProvider class.
 *
 * @returns A new TrdefiActionProvider instance
 */
export const trdefiActionProvider = () => new TrdefiActionProvider();
