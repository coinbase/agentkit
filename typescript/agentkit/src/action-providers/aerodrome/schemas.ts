import { z } from "zod";

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format");
const positiveDecimalStringSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Must be a valid positive decimal value")
  .refine(val => parseFloat(val) > 0, { message: "Amount must be greater than zero" });
const positiveIntegerStringSchema = z
  .string()
  .regex(/^\d+$/, "Must be a valid positive integer")
  .refine(val => BigInt(val) > 0, { message: "Value must be greater than zero" });

export const CreateLockSchema = z
  .object({
    aeroAmount: positiveDecimalStringSchema.describe(
      "Amount of AERO tokens to lock (e.g., '100.5').",
    ),
    lockDurationSeconds: z
      .string()
      .regex(/^\d+$/, "Must be a valid positive integer")
      .describe(
        "Lock duration in seconds. Minimum 604800 (1 week), maximum 126144000 (4 years). The contract rounds duration down to the nearest week boundary.",
      ),
  })
  .describe("Input schema for creating a new veAERO lock on Aerodrome (Base Mainnet).");

export const VoteSchema = z
  .object({
    veAeroTokenId: positiveIntegerStringSchema.describe(
      "The token ID of the veAERO NFT to use for voting.",
    ),
    poolAddresses: z
      .array(addressSchema)
      .min(1, "Must provide at least one pool address")
      .describe("An array of Aerodrome pool addresses to vote for (must have associated gauges)."),
    weights: z
      .array(positiveIntegerStringSchema)
      .min(1, "Must provide at least one weight")
      .describe(
        "An array of positive integer voting weights corresponding to the poolAddresses array. Your veAERO's voting power will be distributed proportionally based on these weights (e.g., [100, 50] means the first pool gets 2/3rds of the vote, the second gets 1/3rd).",
      ),
  })
  .refine(data => data.poolAddresses.length === data.weights.length, {
    message: "Pool addresses and weights arrays must have the same number of elements.",
    path: ["poolAddresses", "weights"],
  })
  .describe("Input schema for casting votes with a veAERO NFT on Aerodrome (Base Mainnet).");

export const SwapExactTokensSchema = z
  .object({
    amountIn: positiveDecimalStringSchema.describe(
      "The exact amount of the input token to swap (e.g., '1.5').",
    ),
    amountOutMin: z
      .string()
      .regex(/^\d+$/, "Must be a valid non-negative integer")
      .describe(
        "The minimum amount of output token expected (in atomic units, e.g., wei) to prevent excessive slippage.",
      ),
    tokenInAddress: addressSchema.describe("Address of the token being swapped FROM."),
    tokenOutAddress: addressSchema.describe("Address of the token being swapped TO."),
    to: addressSchema.describe("Address to receive the output tokens."),
    deadline: positiveIntegerStringSchema.describe(
      "Unix timestamp deadline (seconds since epoch) for the transaction to succeed. Must be in the future.",
    ),
    useStablePool: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Set to true to use the stable pool for the swap, false (default) to use the volatile pool. Ensure the chosen pool type exists for the token pair.",
      ),
  })
  .describe(
    "Input schema for swapping an exact amount of input tokens for a minimum amount of output tokens on Aerodrome (Base Mainnet). Assumes a direct route between the two tokens.",
  );
