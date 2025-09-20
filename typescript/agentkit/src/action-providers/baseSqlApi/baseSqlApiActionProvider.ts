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
 * This provider supports SQL querying on the Base network.
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
   * @param args - Arguments defined by BaseSqlApiSchema, i.e. the SQL query to execute
   * @returns A promise that resolves to a string describing the query result
   */
  @CreateAction({
    name: "execute_base_sql_query",
    description,
    schema: BaseSqlApiSchema,
  })
  async executeBaseSqlQuery(args: z.infer<typeof BaseSqlApiSchema>): Promise<string> {
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

      const result = await response.text();

      return `Query executed with result: ${result}.`;
    } catch (error) {
      return `Error executing Base SQL query: ${error}`;
    }
  }

  /**
   * Checks if this provider supports the given network.
   *
   * @param _ - The network to check support for
   * @returns True if the network is supported
   */
  supportsNetwork(_: Network): boolean {
    // all networks
    return true;
  }
}

/**
 * Factory function to create a new BaseSqlApiActionProvider instance.
 *
 * @returns A new BaseSqlApiActionProvider instance
 */
export const baseSqlApiActionProvider = () => new BaseSqlApiActionProvider();
