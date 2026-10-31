import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import { EvmWalletProvider } from "../../wallet-providers";
import { CdpSqlApiSchema } from "./schemas";
import { description } from "./cdpSqlApiDescription";
import { CDP_SQL_API_URL } from "./constants";

/**
 * Configuration options for the CdpSqlApiActionProvider.
 */
export interface CdpSqlApiActionProviderConfig {
  /**
   * CDP Client API Key. Request new at https://portal.cdp.coinbase.com/projects/api-keys/client-key/
   */
  cdpApiClientKey?: string;
}

/**
 * CdpSqlApiActionProvider provides actions for cdpSqlApi operations.
 *
 * @description
 * This provider supports SQL querying on the Base Sepolia Base network.
 */
export class CdpSqlApiActionProvider extends ActionProvider<EvmWalletProvider> {
  private readonly cdpApiClientKey: string;

  /**
   * Constructor for the CdpSqlApiActionProvider.
   *
   * @param config - The configuration options for the CdpSqlApiActionProvider.
   */
  constructor(config: CdpSqlApiActionProviderConfig = {}) {
    super("cdpSqlApi", []);

    const cdpApiClientKey = config.cdpApiClientKey || process.env.CDP_API_CLIENT_KEY;
    if (!cdpApiClientKey) {
      throw new Error("CDP_API_CLIENT_KEY is not configured.");
    }
    this.cdpApiClientKey = cdpApiClientKey;
  }

  /**
   * CDP SQL API action provider
   *
   * @description
   * This action queries the Coinbase SQL API endpoint to efficiently retrieve onchain data on Base or Base Sepolia.
   *
   * @param args - Arguments defined by CdpSqlApiSchema, i.e. the SQL query to execute
   * @returns A promise that resolves to a string describing the query result
   */
  @CreateAction({
    name: "execute_cdp_sql_query",
    description,
    schema: CdpSqlApiSchema,
  })
  async executeCdpSqlQuery(args: z.infer<typeof CdpSqlApiSchema>): Promise<string> {
    try {
      const response = await fetch(CDP_SQL_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.cdpApiClientKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ sql: args.sqlQuery }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return `Error ${response.status} executing CDP SQL query: ${errorData.errorMessage || response.statusText}`;
      }

      const data = await response.json();
      return JSON.stringify(data.result);
    } catch (error) {
      return `Error executing CDP SQL query: ${error}`;
    }
  }

  /**
   * Checks if this provider supports the given network.
   *
   * @param network - The network to check support for
   * @returns True if the network is supported
   */
  supportsNetwork(network: Network): boolean {
    return network.networkId === "base-mainnet" || network.networkId === "base-sepolia";
  }
}

/**
 * Factory function to create a new CdpSqlApiActionProvider instance.
 *
 * @param config - the config of the cdp sql api action provider, contains the cdp client api key
 * @returns A new CdpSqlApiActionProvider instance
 */
export const cdpSqlApiActionProvider = (config?: CdpSqlApiActionProviderConfig) =>
  new CdpSqlApiActionProvider(config);
