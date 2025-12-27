import { z } from "zod";

/**
 * Action schemas for the dexpaprika action provider.
 *
 * This file contains the Zod schemas that define the shape and validation
 * rules for action parameters in the dexpaprika action provider.
 */

export const getDexPoolsSchema = z.object({
  network: z.string(),
  dex: z.string(),
  sort: z.enum(["asc", "desc"]).default("desc"),
  order_by: z
    .enum(["volume_usd", "price_usd", "transactions", "last_price_change_usd_24h", "created_at"])
    .default("volume_usd"),
});

export const searchSchema = z.object({
  query: z.string(),
});

export const getTopPoolsSchema = z.object({
  query: z.string(),
});

export const getTokenDetailsSchema = z.object({
  network: z.string(),
  token_address: z.string(),
});

export const getPoolDetailsSchema = z.object({
  network: z.string(),
  pool_address: z.string(),
});

export const getNetworkPoolsSchema = z.object({
  network: z.string(),
});

export const getNetworkDexesSchema = z.object({
  network: z.string(),
});
