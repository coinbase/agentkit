import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import {
  NovesTranslatedTxSchema,
  NovesRecentTxsSchema,
  NovesTokenCurrentPriceSchema,
} from "./schemas";
import { IntentProvider } from "@noves/intent-ethers-provider";

/**
 * NovesActionProvider is an action provider for fetching transaction descriptions, recent transactions, and token prices via Noves Intents.
 */
export class NovesActionProvider extends ActionProvider {
  private intentProvider: IntentProvider;

  /**
   * Creates a new instance of NovesActionProvider
   */
  constructor() {
    super("noves", []);
    this.intentProvider = new IntentProvider();
  }

  /**
   * Get a human-readable description of a transaction
   *
   * @param args - The arguments containing the transaction hash and the chain.
   * @returns A JSON string with the transaction description or an error message.
   */
  @CreateAction({
    name: "getTranslatedTransaction",
    description:
      "This tool will fetch a human-readable description of a transaction on a given chain",
    schema: NovesTranslatedTxSchema,
  })
  async getTranslatedTransaction(args: z.infer<typeof NovesTranslatedTxSchema>): Promise<string> {
    try {
      const tx = await this.intentProvider.getTranslatedTx(args.chain, args.tx);
      return JSON.stringify(tx, null, 2);
    } catch (error) {
      return `Error getting translated transaction: ${error}`;
    }
  }

  /**
   * Get a list of recent transactions
   *
   * @param args - The arguments containing the chain and wallet address.
   * @returns A JSON string with the list of recent transactions or an error message.
   */
  @CreateAction({
    name: "getRecentTransactions",
    description:
      "This tool will fetch a list of recent transactions for a given wallet on a given chain",
    schema: NovesRecentTxsSchema,
  })
  async getRecentTransactions(args: z.infer<typeof NovesRecentTxsSchema>): Promise<string> {
    try {
      const txs = await this.intentProvider.getRecentTxs(args.chain, args.wallet);
      return JSON.stringify(txs, null, 2);
    } catch (error) {
      return `Error getting recent transactions: ${error}`;
    }
  }

  /**
   * Get the current price of a token
   *
   * @param args - The arguments containing the chain, token address, and timestamp (optional).
   * @returns A JSON string with the current token price or an error message.
   */
  @CreateAction({
    name: "getTokenCurrentPrice",
    description:
      "This tool will fetch the price of a token on a given chain at a given timestamp or the current price if no timestamp is provided",
    schema: NovesTokenCurrentPriceSchema,
  })
  async getTokenCurrentPrice(args: z.infer<typeof NovesTokenCurrentPriceSchema>): Promise<string> {
    try {
      const price = await this.intentProvider.getTokenPrice({
        chain: args.chain,
        token_address: args.token_address,
        timestamp: args.timestamp ? new Date(args.timestamp).getTime().toString() : undefined,
      });
      return JSON.stringify(price, null, 2);
    } catch (error) {
      return `Error getting token price: ${error}`;
    }
  }

  /**
   * Checks if the Noves action provider supports the given network.
   * Since the API works with +100 networks, this always returns true.
   *
   * @returns Always returns true.
   */
  supportsNetwork = (): boolean => {
    return true;
  };
}

/**
 * Factory function to create a new NovesActionProvider instance.
 *
 * @returns A new instance of NovesActionProvider.
 */
export const novesActionProvider = () => new NovesActionProvider();
