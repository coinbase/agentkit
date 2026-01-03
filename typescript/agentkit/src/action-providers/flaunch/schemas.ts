import { z } from "zod";

/**
 * Action schemas for the flaunch action provider.
 *
 * This file contains the Zod schemas that define the shape and validation
 * rules for action parameters in the flaunch action provider.
 */

/**
 * Schema for Flaunch token creation
 */
export const FlaunchSchema = z
  .object({
    name: z.string().min(1).describe("The name of the token to flaunch"),
    symbol: z.string().min(1).describe("The symbol of the token to flaunch"),
    image: z.string().describe("Local image file path or URL to the token image"),
    description: z.string().describe("Description of the token"),
    websiteUrl: z.string().optional().describe("URL to the token website"),
    discordUrl: z.string().optional().describe("URL to the token Discord"),
    twitterUrl: z.string().optional().describe("URL to the token Twitter"),
    telegramUrl: z.string().optional().describe("URL to the token Telegram"),
    fairLaunchPercent: z
      .number()
      .min(0)
      .max(100)
      .default(60)
      .describe("The percentage of tokens for fair launch (defaults to 60%)"),
    fairLaunchDuration: z
      .number()
      .min(0)
      .default(30)
      .describe("The duration of the fair launch in minutes (defaults to 30 minutes)"),
    initialMarketCapUSD: z
      .number()
      .min(100)
      .max(100000)
      .default(10000)
      .describe("The initial market cap in USD (defaults to 10000 USD)"),
    creatorFeeAllocationPercent: z
      .number()
      .min(0)
      .max(100)
      .default(80)
      .describe(
        "The percentage of the fees allocated to the creator and optional additional receivers (defaults to 80%). Remainder goes to community via token buy backs",
      ),
    creatorSplitPercent: z
      .number()
      .min(0)
      .max(100)
      .default(100)
      .describe(
        "The percentage of the fees allocated to the creator. Defaults to 100%, set to smaller value if fees are to be distributed to additional receivers",
      ),
    splitReceivers: z
      .array(
        z.object({
          address: z
            .string()
            .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
            .describe("The recipient's address"),
          percent: z
            .number()
            .min(0)
            .max(100)
            .describe(
              "The percentage share for the recipient. All split receiver percentages must add up to 100%",
            ),
        }),
      )
      .optional()
      .describe("The recipients for the fee split (optional)"),
    preminePercent: z
      .number()
      .min(0)
      .max(100)
      .default(0)
      .describe(
        "The percentage of total supply to premine (defaults to 0%, max is equal to fairLaunchPercent)",
      ),
  })
  .strip()
  .describe("Instructions for creating a new memecoin using the flaunch protocol.");

export const BuyCoinWithETHInputSchema = z.object({
  coinAddress: z
    .string()
    .describe("The address of the flaunch coin to buy")
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"),
  amountIn: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
    .describe("The quantity of ETH to spend on the flaunch coin, in whole units"),
  slippagePercent: z
    .number()
    .min(0)
    .max(100)
    .default(5)
    .describe("The slippage percentage. Default to 5%"),
});

export const BuyCoinWithCoinInputSchema = z.object({
  coinAddress: z
    .string()
    .describe("The address of the flaunch coin to buy")
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"),
  amountOut: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
    .describe("The quantity of the flaunch coin to buy, in whole units"),
  slippagePercent: z
    .number()
    .min(0)
    .max(100)
    .default(5)
    .describe("The slippage percentage. Default to 5%"),
});

export const SellCoinSchema = z.object({
  coinAddress: z
    .string()
    .describe("The address of the flaunch coin to sell")
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"),
  amountIn: z
    .string()
    .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
    .describe("The quantity of the flaunch coin to sell, in whole units"),
  slippagePercent: z
    .number()
    .min(0)
    .max(100)
    .default(5)
    .describe("The slippage percentage. Default to 5%"),
});
