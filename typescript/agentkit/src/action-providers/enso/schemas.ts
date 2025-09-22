import { z } from "zod";

export interface EnsoActionProviderParams {
  apiKey?: string;
}

/**
 * Input schema for route action.
 */
export const EnsoRouteSchema = z
  .object({
    tokenIn: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe(
        "Address of the token to swap from. For ETH, use 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      ),
    tokenOut: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe(
        "Address of the token to swap to, For ETH, use 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      ),
    amountIn: z.string().describe("Amount of tokenIn to swap in whole units (e.g. 100 USDC)"),
    slippage: z.number().optional().describe("Slippage in basis points (1/10000). Default - 50"),
  })
  .strip()
  .describe("Instructions for routing through Enso API");
