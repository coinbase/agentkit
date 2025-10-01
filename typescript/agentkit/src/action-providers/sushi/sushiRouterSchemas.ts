import type { Address } from "viem";
import { z } from "zod";

/**
 * Input schema for asset swap action
 */
export const SushiSwapSchema = z
  .object({
    fromAssetAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .transform(val => val as Address)
      .describe("The Ethereum address of the input asset"),
    amount: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Invalid number format")
      .describe("The amount of the input asset to swap, in the human readable format"),
    toAssetAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .transform(val => val as Address)
      .describe("The Ethereum address of the output asset"),
    maxSlippage: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .default(0.005) // 0.05%
      .describe("The maximum slippage allowed for the swap, where 0 is 0% and 1 is 100%"),
  })
  .strip()
  .describe("Instructions for trading assets");

/**
 * Input schema for quote action
 */
export const SushiQuoteSchema = z
  .object({
    fromAssetAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .transform(val => val as Address)
      .describe("The Ethereum address of the input asset"),
    amount: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Invalid number format")
      .describe("The amount of the input asset to get a quote for"),
    toAssetAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .transform(val => val as Address)
      .describe("The Ethereum address of the output asset"),
  })
  .strip()
  .describe("Instructions for fetching a quote for a trade");
