import { z } from "zod";

/** Ethereum address validation pattern */
const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;

/** Token input — accepts either an address or 'native' for ETH */
const TokenInputSchema = z
  .string()
  .regex(
    /^(0x[a-fA-F0-9]{40}|native)$/,
    "Must be a valid Ethereum address (0x...) or 'native' for ETH",
  );

/** Positive decimal number as string */
const AmountSchema = z
  .string()
  .regex(/^\d+\.?\d*$/, "Amount must be a positive number")
  .refine(val => parseFloat(val) > 0, "Amount must be greater than zero");

/**
 * Schema for getting a swap quote without executing.
 */
export const GetV4QuoteSchema = z
  .object({
    tokenIn: TokenInputSchema.describe(
      "Contract address of the input token (token to sell). Use 'native' for ETH.",
    ),
    tokenOut: z
      .string()
      .regex(ethAddressRegex, "Invalid Ethereum address format")
      .describe("Contract address of the output token (token to buy)."),
    amountIn: AmountSchema.describe(
      "Amount of input token in human-readable units (e.g., '1.5' for 1.5 tokens).",
    ),
    slippageTolerance: z
      .string()
      .optional()
      .default("0.5")
      .describe("Maximum acceptable slippage percentage (default: 0.5%)."),
  })
  .strip()
  .describe("Get a price quote for a Uniswap V4 swap without executing.");

/**
 * Schema for executing a swap with exact input amount.
 */
export const SwapExactInputSchema = z
  .object({
    tokenIn: TokenInputSchema.describe(
      "Contract address of the token to sell. Use 'native' for ETH.",
    ),
    tokenOut: z
      .string()
      .regex(ethAddressRegex, "Invalid Ethereum address format")
      .describe("Contract address of the token to buy."),
    amountIn: AmountSchema.describe(
      "Exact amount of input token to swap, in human-readable units.",
    ),
    slippageTolerance: z
      .string()
      .optional()
      .default("0.5")
      .describe("Maximum acceptable slippage percentage (default: 0.5%)."),
    recipient: z
      .string()
      .regex(ethAddressRegex, "Invalid Ethereum address format")
      .optional()
      .describe("Address to receive output tokens. Defaults to wallet address."),
  })
  .strip()
  .describe("Execute a Uniswap V4 swap with an exact input amount.");

/**
 * Schema for executing a swap with exact output amount.
 */
export const SwapExactOutputSchema = z
  .object({
    tokenIn: TokenInputSchema.describe(
      "Contract address of the token to sell. Use 'native' for ETH.",
    ),
    tokenOut: z
      .string()
      .regex(ethAddressRegex, "Invalid Ethereum address format")
      .describe("Contract address of the token to buy."),
    amountOut: AmountSchema.describe(
      "Exact amount of output token desired, in human-readable units.",
    ),
    slippageTolerance: z
      .string()
      .optional()
      .default("0.5")
      .describe("Maximum acceptable slippage percentage (default: 0.5%)."),
    recipient: z
      .string()
      .regex(ethAddressRegex, "Invalid Ethereum address format")
      .optional()
      .describe("Address to receive output tokens. Defaults to wallet address."),
  })
  .strip()
  .describe("Execute a Uniswap V4 swap specifying exact desired output.");
