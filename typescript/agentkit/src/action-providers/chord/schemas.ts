import { z } from "zod";
import { DEFAULT_SLIPPAGE_BPS } from "./constants";

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address format");

const amountSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Invalid number format")
  .describe("Amount of the input token in whole units, e.g. '1.5' for 1.5 ETH or '10' for 10 USDC");

const slippageSchema = z
  .number()
  .int()
  .min(1)
  .max(5000)
  .nullable()
  .transform(val => val ?? DEFAULT_SLIPPAGE_BPS)
  .describe("Maximum slippage in basis points, 1-5000 (50 = 0.5%). Null uses the default of 50.");

/**
 * Input schema for the token search action.
 */
export const ChordSearchTokensSchema = z
  .object({
    query: z
      .string()
      .min(1)
      .max(64)
      .describe("Token symbol, name or address fragment, e.g. 'USDC' or 'wrapped ether'"),
  })
  .strip()
  .describe("Instructions for searching tokens on the wallet's chain");

/**
 * Input schema for the swap quote action.
 */
export const ChordGetSwapQuoteSchema = z
  .object({
    fromToken: addressSchema.describe(
      "Address of the token to sell. Use 0x0000000000000000000000000000000000000000 for the chain's native coin",
    ),
    toToken: addressSchema.describe(
      "Address of the token to buy. Use 0x0000000000000000000000000000000000000000 for the chain's native coin",
    ),
    amount: amountSchema,
    slippageBps: slippageSchema,
  })
  .strip()
  .describe("Instructions for fetching a swap quote from Chord");

/**
 * Input schema for the swap action.
 */
export const ChordSwapSchema = z
  .object({
    fromToken: addressSchema.describe(
      "Address of the token to sell. Use 0x0000000000000000000000000000000000000000 for the chain's native coin",
    ),
    toToken: addressSchema.describe(
      "Address of the token to buy. Use 0x0000000000000000000000000000000000000000 for the chain's native coin",
    ),
    amount: amountSchema,
    slippageBps: slippageSchema,
  })
  .strip()
  .describe("Instructions for swapping tokens through the Chord router");
