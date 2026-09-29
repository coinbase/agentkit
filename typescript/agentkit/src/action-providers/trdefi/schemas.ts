import { z } from "zod";

/**
 * Input schema for listing TRDEFI strategies
 */
export const ListStrategiesSchema = z
  .object({
    chain: z.string().describe("Chain key, one of: ethereum, base, arbitrum, optimism, polygon"),
    q: z.string().nullable().describe("Optional free-text search over pairs and makers"),
    pair: z.string().nullable().describe("Optional pair filter, e.g. 'USDC/USDT'"),
  })
  .strict();

/**
 * Input schema for getting a single TRDEFI strategy
 */
export const GetStrategySchema = z
  .object({
    hash: z.string().describe("The strategy hash (0x...)"),
  })
  .strict();

/**
 * Input schema for quoting a swap against a TRDEFI strategy
 */
export const GetQuoteSchema = z
  .object({
    hash: z.string().describe("The strategy hash (0x...)"),
    chain: z.string().describe("Chain key, one of: ethereum, base, arbitrum, optimism, polygon"),
    amount: z.string().describe("Input amount in the token's base units, e.g. '1000000'"),
    direction: z.string().describe("Swap direction: 'aToB' or 'bToA'"),
  })
  .strict();
