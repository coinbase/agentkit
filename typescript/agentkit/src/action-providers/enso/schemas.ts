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
    slippage: z
      .number()
      .int()
      .min(0)
      .max(10000)
      .nullable()
      .describe(
        "Slippage in basis points (0-10000, 1/10000 units). Default 50 (0.5%). Caps match Jupiter/0x.",
      ),
  })
  .describe("Instructions for routing through Enso API");
