import { z } from "zod";
import { isAddress } from "viem";

const ethereumAddress = z.custom<`0x${string}`>(
  (val) => typeof val === "string" && isAddress(val),
  "Invalid Ethereum address",
);

/**
 * Input schema for creating a token.
 */
export const PumpclawCreateTokenInput = z
  .object({
    name: z
      .string()
      .min(1)
      .describe("The name of the token to create (e.g., 'My Token')"),
    symbol: z
      .string()
      .min(1)
      .describe("The symbol of the token to create (e.g., 'MTK')"),
    imageUrl: z
      .string()
      .url()
      .describe("The image URL for the token (must be a valid URL)"),
    totalSupply: z
      .string()
      .regex(/^\d+$/, "Must be a valid wei amount (no decimals)")
      .default("1000000000000000000000000000")
      .describe(
        "Total supply in wei (default: 1B tokens = 1000000000000000000000000000)",
      ),
    initialFdv: z
      .string()
      .regex(/^\d+$/, "Must be a valid wei amount (no decimals)")
      .default("10000000000000000000")
      .describe(
        "Initial FDV in wei (default: 10 ETH = 10000000000000000000)",
      ),
    creator: ethereumAddress
      .optional()
      .describe(
        "Address of the token creator (defaults to sender if omitted)",
      ),
  })
  .strip()
  .describe("Instructions for creating a new PumpClaw token");

/**
 * Input schema for getting token information.
 */
export const PumpclawGetTokenInfoInput = z
  .object({
    tokenAddress: ethereumAddress.describe(
      "The PumpClaw token contract address to get information for",
    ),
  })
  .strip()
  .describe("Instructions for getting PumpClaw token information");

/**
 * Input schema for listing tokens.
 */
export const PumpclawListTokensInput = z
  .object({
    offset: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Starting index for token list (default: 0)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10)
      .describe("Maximum number of tokens to return (default: 10, max: 100)"),
  })
  .strip()
  .describe("Instructions for listing PumpClaw tokens");

/**
 * Input schema for buying tokens.
 */
export const PumpclawBuyTokenInput = z
  .object({
    tokenAddress: ethereumAddress.describe(
      "The PumpClaw token contract address to buy",
    ),
    ethAmount: z
      .string()
      .regex(/^\d+$/, "Must be a valid wei amount (no decimals)")
      .describe("Amount of ETH to spend in wei (e.g., '1000000000000000000' for 1 ETH)"),
    minTokensOut: z
      .string()
      .regex(/^\d+$/, "Must be a valid wei amount (no decimals)")
      .default("0")
      .describe(
        "Minimum tokens to receive in wei (slippage protection, default: 0)",
      ),
  })
  .strip()
  .describe("Instructions for buying PumpClaw tokens with ETH");

/**
 * Input schema for selling tokens.
 */
export const PumpclawSellTokenInput = z
  .object({
    tokenAddress: ethereumAddress.describe(
      "The PumpClaw token contract address to sell",
    ),
    tokensIn: z
      .string()
      .regex(/^\d+$/, "Must be a valid wei amount (no decimals)")
      .describe(
        "Amount of tokens to sell in wei (e.g., '1000000000000000000' for 1 token with 18 decimals)",
      ),
    minEthOut: z
      .string()
      .regex(/^\d+$/, "Must be a valid wei amount (no decimals)")
      .default("0")
      .describe(
        "Minimum ETH to receive in wei (slippage protection, default: 0)",
      ),
  })
  .strip()
  .describe("Instructions for selling PumpClaw tokens for ETH");

/**
 * Input schema for setting image URL.
 */
export const PumpclawSetImageUrlInput = z
  .object({
    tokenAddress: ethereumAddress.describe(
      "The PumpClaw token contract address to update",
    ),
    imageUrl: z
      .string()
      .url()
      .describe("The new image URL for the token (must be a valid URL)"),
  })
  .strip()
  .describe("Instructions for updating PumpClaw token image URL");
