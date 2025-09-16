import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { BaseSqlApiSchema } from "./schemas";
import { description } from "./baseSqlApiDescription";
import { BASE_SQL_API_URL } from "./constants";

/**
 * BaseSqlApiActionProvider provides actions for baseSqlApi operations.
 *
 * @description
 * This provider is designed to work with EvmWalletProvider for blockchain interactions.
 * It supports querying on the Base network.
 */
export class BaseSqlApiActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructor for the BaseSqlApiActionProvider.
   */
  constructor() {
    super("baseSqlApi", []);
  }

  /**
   * Base SQL API action provider
   *
   * @description
   * This action queries the Coinbase SQL API endpoint to efficiently retrieve onchain data on Base.
   *
   * @param walletProvider - The wallet provider instance for blockchain interactions
   * @param args - Arguments defined by BaseSqlApiSchema, i.e. the SQL query to execute
   * @returns A promise that resolves to a string describing the query result
   */
  @CreateAction({
    name: "execute_base_sql_query",
    description,
    schema: BaseSqlApiSchema,
  })
  async exampleAction(
    walletProvider: EvmWalletProvider,
    args: z.infer<typeof BaseSqlApiSchema>,
  ): Promise<string> {
    try {
      const cdpApiKey = process.env.CDP_API_CLIENT_KEY;

      const response = await fetch(BASE_SQL_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cdpApiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ sql: args.sqlQuery }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log("Resp: " + response)

      const result = await response.text();

      console.log("Result: " + result)

      return `Query executed with result: ${result}.`;
    } catch (error) {
      return `Error executing Base SQL query: ${error}`;
    }
  }

  /**
   * Checks if this provider supports the given network.
   *
   * @param network - The network to check support for
   * @returns True if the network is supported
   */
  supportsNetwork(network: Network): boolean {
    return network.networkId === "base-mainnet";
  }
}

/**
 * Factory function to create a new BaseSqlApiActionProvider instance.
 *
 * @returns A new BaseSqlApiActionProvider instance
 */
export const baseSqlApiActionProvider = () => new BaseSqlApiActionProvider();
