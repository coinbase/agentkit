import { z } from "zod";

export interface EnsoActionProviderParams {
  apiKey?: string;
}

/**
 * Input schema for route action.
 */
export const EnsoRouteSchema = z
  .object({
    network: z.string().describe("The network to check the address on"),
    tokenIn: z
      .string()
      .describe(
        "Address of the token to swap from. For ETH, use 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      ),
    tokenOut: z
      .string()
      .describe(
        "Address of the token to swap to, For ETH, use 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      ),
    amountIn: z.custom<bigint>().describe("Amount of tokenIn to swap in wei"),
    slippage: z.number().optional().describe("Slippage in basis points (1/10000). Default - 50"),
  })
  .strip()
  .describe("Instructions for routing through Enso API");
