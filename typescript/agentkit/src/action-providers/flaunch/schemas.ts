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
export const FlaunchSchema = z.object({
  name: z.string().min(1).describe("The name of the token"),
  symbol: z.string().min(1).describe("The symbol of the token"),
  imageUrl: z.string().url().describe("The URL to the token image"),
  description: z.string().describe("The description of the token"),
  websiteUrl: z.string().url().optional().describe("The (optional) URL to the token website"),
  discordUrl: z.string().url().optional().describe("The (optional) URL to the token Discord"),
  twitterUrl: z.string().url().optional().describe("The (optional) URL to the token Twitter"),
  telegramUrl: z.string().url().optional().describe("The (optional) URL to the token Telegram"),
});

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
