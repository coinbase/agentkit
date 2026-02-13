import { z } from "zod";
import { isAddress } from "viem";

const ethereumAddress = z.custom<`0x${string}`>(
  (val) => typeof val === "string" && isAddress(val),
  "Invalid Ethereum address",
);

/**
 * Input schema for getting token information.
 */
export const MintclubGetTokenInfoInput = z
  .object({
    tokenAddress: ethereumAddress.describe(
      "The Mint Club V2 token contract address to get information for",
    ),
  })
  .strip()
  .describe("Instructions for getting Mint Club token information");

/**
 * Input schema for getting token price.
 */
export const MintclubGetTokenPriceInput = z
  .object({
    tokenAddress: ethereumAddress.describe(
      "The Mint Club V2 token contract address to get price for",
    ),
    amount: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid number")
      .describe(
        "Amount of tokens to price in whole units (e.g., '1' or '100.5')",
      ),
  })
  .strip()
  .describe("Instructions for getting Mint Club token price");

/**
 * Input schema for buying tokens.
 */
export const MintclubBuyTokenInput = z
  .object({
    tokenAddress: ethereumAddress.describe(
      "The Mint Club V2 token contract address to buy",
    ),
    tokensToMint: z
      .string()
      .regex(/^\d+$/, "Must be a valid wei amount (no decimals)")
      .describe(
        "Amount of tokens to mint in wei (e.g., '1000000000000000000' for 1 token with 18 decimals)",
      ),
    maxReserveAmount: z
      .string()
      .regex(/^\d+$/, "Must be a valid wei amount (no decimals)")
      .describe(
        "Maximum reserve tokens to spend in wei (slippage protection — reverts if cost exceeds this)",
      ),
    recipient: ethereumAddress
      .optional()
      .describe(
        "Address to receive the minted tokens (defaults to sender if omitted)",
      ),
  })
  .strip()
  .describe("Instructions for buying Mint Club tokens via bonding curve");

/**
 * Input schema for selling tokens.
 */
export const MintclubSellTokenInput = z
  .object({
    tokenAddress: ethereumAddress.describe(
      "The Mint Club V2 token contract address to sell",
    ),
    tokensToBurn: z
      .string()
      .regex(/^\d+$/, "Must be a valid wei amount (no decimals)")
      .describe(
        "Amount of tokens to burn in wei (e.g., '1000000000000000000' for 1 token with 18 decimals)",
      ),
    minRefund: z
      .string()
      .regex(/^\d+$/, "Must be a valid wei amount (no decimals)")
      .describe(
        "Minimum reserve tokens to receive in wei (slippage protection — reverts if refund is less)",
      ),
    recipient: ethereumAddress
      .optional()
      .describe(
        "Address to receive the reserve token refund (defaults to sender if omitted)",
      ),
  })
  .strip()
  .describe("Instructions for selling Mint Club tokens via bonding curve");

/**
 * Input schema for creating tokens.
 */
export const MintclubCreateTokenInput = z
  .object({
    name: z
      .string()
      .min(1)
      .describe("The name of the token to create (e.g., 'My Token')"),
    symbol: z
      .string()
      .min(1)
      .describe("The symbol of the token to create (e.g., 'MTK')"),
    reserveToken: ethereumAddress.describe(
      "The reserve token address that backs the bonding curve (e.g., HUNT, USDC, or WETH address)",
    ),
    maxSupply: z
      .string()
      .regex(/^\d+$/, "Must be a valid wei amount (no decimals)")
      .describe("Maximum token supply in wei"),
    stepRanges: z
      .array(z.string().regex(/^\d+$/, "Must be a valid wei amount"))
      .min(1)
      .describe(
        "Cumulative supply thresholds for each bonding curve step in wei. Last value must equal maxSupply.",
      ),
    stepPrices: z
      .array(z.string().regex(/^\d+$/, "Must be a valid wei amount"))
      .min(1)
      .describe(
        "Price per token at each bonding curve step (multiplied by 10^18 for precision). Must have same length as stepRanges.",
      ),
    mintRoyalty: z
      .number()
      .int()
      .min(0)
      .max(5000)
      .describe(
        "Mint royalty in basis points (0–5000, where 100 = 1%). Max 50%.",
      ),
    burnRoyalty: z
      .number()
      .int()
      .min(0)
      .max(5000)
      .describe(
        "Burn royalty in basis points (0–5000, where 100 = 1%). Max 50%.",
      ),
  })
  .strip()
  .describe("Instructions for creating a new Mint Club V2 token with bonding curve");
