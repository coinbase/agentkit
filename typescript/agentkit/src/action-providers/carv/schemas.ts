// typescript/agentkit/src/action-providers/carv/schemas.ts

import { z } from "zod";

/**
 * Input schema for getting user address by Discord ID.
 */
export const CarvGetAddressByDiscordIdSchema = z
  .object({
    discordUserId: z
      .string()
      .describe("The Discord user ID to look up"),
    chainName: z
      .string()
      .optional()
      .default("base")
      .describe("The blockchain network name (e.g., base, ethereum, opbnb). Defaults to 'base'"),
    tokenTicker: z
      .string()
      .optional()
      .default("carv")
      .describe("The token ticker symbol. Defaults to 'carv'"),
  })
  .strip()
  .describe("Instructions for getting user wallet address by Discord ID");

/**
 * Input schema for getting user address by Twitter ID.
 */
export const CarvGetAddressByTwitterIdSchema = z
  .object({
    twitterUserId: z
      .string()
      .describe("The Twitter user ID or username to look up"),
    chainName: z
      .string()
      .optional()
      .default("ethereum")
      .describe("The blockchain network name (e.g., base, ethereum, opbnb). Defaults to 'ethereum'"),
    tokenTicker: z
      .string()
      .optional()
      .default("carv")
      .describe("The token ticker symbol. Defaults to 'carv'"),
  })
  .strip()
  .describe("Instructions for getting user wallet address by Twitter ID");

/**
 * Input schema for getting user balance by Discord ID.
 */
export const CarvGetBalanceByDiscordIdSchema = z
  .object({
    discordUserId: z
      .string()
      .describe("The Discord user ID to look up"),
    chainName: z
      .string()
      .optional()
      .default("base")
      .describe("The blockchain network name (e.g., base, ethereum, opbnb). Defaults to 'base'"),
    tokenTicker: z
      .string()
      .optional()
      .default("carv")
      .describe("The token ticker symbol. Defaults to 'carv'"),
  })
  .strip()
  .describe("Instructions for getting user token balance by Discord ID");

/**
 * Input schema for getting user balance by Twitter ID.
 */
export const CarvGetBalanceByTwitterIdSchema = z
  .object({
    twitterUserId: z
      .string()
      .describe("The Twitter user ID or username to look up"),
    chainName: z
      .string()
      .optional()
      .default("ethereum")
      .describe("The blockchain network name (e.g., base, ethereum, opbnb). Defaults to 'ethereum'"),
    tokenTicker: z
      .string()
      .optional()
      .default("carv")
      .describe("The token ticker symbol. Defaults to 'carv'"),
  })
  .strip()
  .describe("Instructions for getting user token balance by Twitter ID");