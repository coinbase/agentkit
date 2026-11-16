import { z } from "zod";
import { DEFAULT_SLIPPAGE_BPS } from "./constants";

const amountSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Amount must be a positive decimal number, e.g. '10' or '0.5'")
  .refine(val => /[1-9]/.test(val), "Amount must be greater than zero")
  .describe("The amount of the input token to swap, in whole units (e.g. '10' for 10 USDC)");

/**
 * Input schema for the get supported tokens action.
 */
export const SodaxGetSupportedTokensSchema = z
  .object({
    chainKey: z
      .string()
      .nullable()
      .describe(
        "SODAX chain key to list tokens for (e.g. '0x2105.base', '0xa4b1.arbitrum', 'solana', 'sonic'). Use 'all' to list every chain. Defaults to the wallet's current network",
      ),
  })
  .describe("Instructions for listing the tokens SODAX can swap");

/**
 * Input schema for the get quote action.
 */
export const SodaxGetQuoteSchema = z
  .object({
    inputToken: z
      .string()
      .describe(
        "Symbol or address of the token to sell on the wallet's current network (e.g. 'USDC' or '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'). Use 0x0000000000000000000000000000000000000000 or the native symbol (e.g. 'ETH') for the native asset",
      ),
    outputToken: z
      .string()
      .describe(
        "Symbol or address of the token to receive on the destination network (e.g. 'USDC' or 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')",
      ),
    destinationChainKey: z
      .string()
      .nullable()
      .describe(
        "SODAX chain key of the destination network (e.g. 'solana', '0xa4b1.arbitrum', 'sonic'). Defaults to the wallet's current network (same-chain swap)",
      ),
    amount: amountSchema,
  })
  .describe("Instructions for getting a SODAX swap quote");

/**
 * Input schema for the swap action.
 */
export const SodaxSwapSchema = z
  .object({
    inputToken: z
      .string()
      .describe(
        "Symbol or address of the token to sell on the wallet's current network. Use 0x0000000000000000000000000000000000000000 or the native symbol (e.g. 'ETH') for the native asset",
      ),
    outputToken: z
      .string()
      .describe("Symbol or address of the token to receive on the destination network"),
    destinationChainKey: z
      .string()
      .nullable()
      .describe(
        "SODAX chain key of the destination network (e.g. 'solana', '0xa4b1.arbitrum'). Defaults to the wallet's current network (same-chain swap)",
      ),
    amount: amountSchema,
    destinationAddress: z
      .string()
      .nullable()
      .describe(
        "Recipient address on the destination network. Required when the destination is not an EVM network (e.g. a Solana address). Defaults to the wallet address for EVM destinations",
      ),
    slippageBps: z
      .number()
      .int()
      .min(0)
      .max(5000)
      .nullable()
      .transform(val => val ?? DEFAULT_SLIPPAGE_BPS)
      .describe("Maximum slippage in basis points, where 100 = 1% (default: 100)"),
  })
  .describe("Instructions for executing a SODAX swap");

/**
 * Input schema for the get swap status action.
 */
export const SodaxGetSwapStatusSchema = z
  .object({
    txHash: z
      .string()
      .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash")
      .describe("Hash of the source-chain transaction that created the swap intent"),
    sourceChainKey: z
      .string()
      .nullable()
      .describe(
        "SODAX chain key of the network the swap was created on. Defaults to the wallet's current network",
      ),
  })
  .describe("Instructions for checking the status of a SODAX swap");
