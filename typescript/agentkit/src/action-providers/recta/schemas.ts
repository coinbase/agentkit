import { z } from "zod";
import { RECTA_BASELINE_PROVIDERS } from "./constants";

/**
 * Input schema for the route coverage and saving odds actions.
 */
export const RectaCorridorSchema = z
  .object({
    destinationNetwork: z
      .string()
      .describe(
        "Recta's name for the destination network, e.g. 'arbitrum', 'base', 'ethereum', 'optimism', 'polygon', 'avalanche', 'bnb_chain', 'linea', 'unichain'",
      ),
    asset: z
      .string()
      .nullable()
      .transform(val => val ?? "USDC")
      .describe("The stablecoin to move, e.g. 'USDC' or 'USDT' (defaults to USDC)"),
  })
  .strip()
  .describe("A cross-chain stablecoin corridor that starts on the wallet's current network");

/**
 * Input schema for the route comparison action.
 */
export const RectaCompareRouteSchema = z
  .object({
    destinationNetwork: z
      .string()
      .describe("Recta's name for the destination network, e.g. 'arbitrum', 'base', 'ethereum'"),
    asset: z
      .string()
      .nullable()
      .transform(val => val ?? "USDC")
      .describe("The stablecoin to move, e.g. 'USDC' or 'USDT' (defaults to USDC)"),
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,6})?$/, "Amount must be a decimal number of whole units, e.g. 6000 or 250.5")
      .describe("The amount to move in whole units, e.g. '6000' for 6,000 USDC"),
    baselineProvider: z
      .enum(RECTA_BASELINE_PROVIDERS)
      .describe(
        "The route the agent would use without Recta (e.g. 'stargate_v2' or 'across'). The saving is measured against it",
      ),
    recipient: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address format")
      .nullable()
      .describe("Who receives the funds on the destination network (defaults to the wallet address)"),
  })
  .strip()
  .describe("A planned cross-chain stablecoin transfer to compare against a cheaper provable route");
