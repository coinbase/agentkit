import { z } from "zod";

const tokenField = (what: string) =>
  z
    .string()
    .min(1)
    .describe(
      `The contract address of the token to ${what} (native ETH/gas token: 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE)`,
    );

/**
 * Input schema for getting a SwapChan quote.
 */
export const SwapChanQuoteSchema = z
  .object({
    fromToken: tokenField("sell").regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"),
    toToken: tokenField("buy").describe(
      "The token to buy: an EVM contract address, or a native token / mint address on toChainId for cross-chain swaps",
    ),
    amount: z
      .string()
      .describe("The amount of fromToken to sell in whole units (e.g., 1.5 WETH, 10 USDC)"),
    toChainId: z
      .number()
      .int()
      .nullable()
      .describe(
        "Destination chain id for cross-chain swaps (1 Ethereum, 10 Optimism, 56 BNB, 137 Polygon, 8453 Base, 42161 Arbitrum, 43114 Avalanche, 792703809 Solana, 8253038 Bitcoin, 728126428 Tron). Null for a same-chain swap",
      ),
    toAddress: z
      .string()
      .nullable()
      .describe(
        "Recipient on the destination chain. Required when the destination is not an EVM chain; defaults to the wallet address",
      ),
    slippageBps: z
      .number()
      .int()
      .min(0)
      .max(5000)
      .nullable()
      .transform(val => val ?? 50)
      .describe("The maximum acceptable slippage in basis points (0-5000, default: 50)"),
  })
  .strip()
  .describe("Get ranked swap/bridge quotes from SwapChan");

/**
 * Input schema for executing a SwapChan swap.
 */
export const SwapChanSwapSchema = SwapChanQuoteSchema.describe(
  "Execute a swap or bridge at the best SwapChan route",
);
