import { z } from "zod";
import { getAddress } from "viem";

/** Token input — accepts either an address or 'native' for ETH */
const TokenInputSchema = z
  .string()
  .refine(
    (val) => {
      if (val.toLowerCase() === "native") return true;
      // Strict checksum validation - must match exact checksummed address
      try {
        const checksummed = getAddress(val);
        return checksummed === val;
      } catch {
        return false;
      }
    },
    "Must be a valid checksummed Ethereum address or 'native' for ETH",
  );

/** Positive decimal number as string */
const AmountSchema = z
  .string()
  .regex(/^\d+\.?\d*$/, "Amount must be a positive number")
  .refine((val) => parseFloat(val) > 0, "Amount must be greater than zero");

/** Slippage tolerance validation (0.01% to 50%) */
const SlippageSchema = z
  .string()
  .optional()
  .default("0.5")
  .refine(
    (val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num >= 0.01 && num <= 50;
    },
    "Slippage tolerance must be between 0.01% and 50%",
  );

/** Ethereum address validation with checksum */
const EthAddressSchema = z.string().refine(
  (val) => {
    try {
      // Verify it's a valid address and matches the checksum
      const checksummed = getAddress(val);
      return checksummed === val;
    } catch {
      return false;
    }
  },
  "Must be a valid checksummed Ethereum address",
);

/**
 * Schema for getting a swap quote without executing.
 */
export const GetV4QuoteSchema = z
  .object({
    tokenIn: TokenInputSchema.describe(
      "Contract address of the input token (token to sell). Use 'native' for ETH.",
    ),
    tokenOut: EthAddressSchema.describe(
      "Contract address of the output token (token to buy).",
    ),
    amountIn: AmountSchema.describe(
      "Amount of input token in human-readable units (e.g., '1.5' for 1.5 tokens).",
    ),
    slippageTolerance: SlippageSchema.describe(
      "Maximum acceptable slippage percentage (default: 0.5%, max: 50%).",
    ),
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
    tokenOut: EthAddressSchema.describe(
      "Contract address of the token to buy.",
    ),
    amountIn: AmountSchema.describe(
      "Exact amount of input token to swap, in human-readable units.",
    ),
    slippageTolerance: SlippageSchema.describe(
      "Maximum acceptable slippage percentage (default: 0.5%, max: 50%).",
    ),
    recipient: EthAddressSchema.optional().describe(
      "Address to receive output tokens. Defaults to wallet address.",
    ),
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
    tokenOut: EthAddressSchema.describe(
      "Contract address of the token to buy.",
    ),
    amountOut: AmountSchema.describe(
      "Exact amount of output token desired, in human-readable units.",
    ),
    slippageTolerance: SlippageSchema.describe(
      "Maximum acceptable slippage percentage (default: 0.5%, max: 50%).",
    ),
    recipient: EthAddressSchema.optional().describe(
      "Address to receive output tokens. Defaults to wallet address.",
    ),
  })
  .strip()
  .describe("Execute a Uniswap V4 swap specifying exact desired output.");
