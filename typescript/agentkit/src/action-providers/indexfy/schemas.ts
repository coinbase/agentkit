import { z } from "zod";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid Ethereum address");
const decimal = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Must be a positive decimal number, e.g. '25' or '0.5'");

/** An index is named by its token address, or by its ticker (e.g. "I5"), resolved through list_indexes. */
const indexRef = z
  .string()
  .min(1)
  .describe("The index's token address on Base, or its ticker symbol, e.g. 'I5'");

export const ListIndexesSchema = z
  .object({
    sort: z
      .enum(["tvl", "newest"])
      .default("tvl")
      .describe("Order by TVL (default) or launch date"),
    limit: z.number().int().min(1).max(50).default(20).describe("How many indexes to return"),
  })
  .strip()
  .describe("Instructions for listing Indexfy indexes");

export const GetIndexSchema = z
  .object({ index: indexRef })
  .strip()
  .describe("Instructions for getting one Indexfy index's details and holdings");

export const GetPortfolioSchema = z
  .object({
    wallet: address.optional().describe("Wallet to look up; defaults to the agent's own wallet"),
  })
  .strip()
  .describe("Instructions for getting a wallet's Indexfy index positions");

export const BuyIndexSchema = z
  .object({
    index: indexRef,
    usdcAmount: decimal.describe("Maximum USDC to spend, in whole USDC, e.g. '25'"),
  })
  .strip()
  .describe("Instructions for buying an Indexfy index with USDC");

export const SellIndexSchema = z
  .object({
    index: indexRef,
    shares: z
      .union([decimal, z.literal("all")])
      .describe(
        "Index shares to sell, in whole shares (e.g. '12.5'), or 'all' to sell the whole position",
      ),
  })
  .strip()
  .describe("Instructions for selling Indexfy index shares for USDC");
