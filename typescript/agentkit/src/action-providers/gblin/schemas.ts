import { z } from "zod";

/**
 * Input schema for buying GBLIN with ETH.
 */
export const BuyGblinSchema = z
  .object({
    ethAmount: z
      .string()
      .describe("Amount of ETH to spend, in whole units (e.g. '0.1' for 0.1 ETH)"),
    slippageBps: z
      .number()
      .int()
      .min(0)
      .max(2000)
      .optional()
      .describe("Max slippage in basis points applied to the on-chain quote. Default 100 (1%)."),
  })
  .strip()
  .describe("Instructions for buying GBLIN with ETH");

/**
 * Input schema for redeeming GBLIN back to ETH.
 */
export const SellGblinForEthSchema = z
  .object({
    gblinAmount: z
      .string()
      .describe("Amount of GBLIN to redeem, in whole units (e.g. '5' for 5 GBLIN)"),
    slippageBps: z
      .number()
      .int()
      .min(0)
      .max(2000)
      .optional()
      .describe("Max slippage in basis points applied to the on-chain quote. Default 100 (1%)."),
  })
  .strip()
  .describe("Instructions for redeeming GBLIN back to ETH");

/**
 * Input schema for reading GBLIN treasury state (no arguments).
 */
export const GetTreasuryStateSchema = z
  .object({})
  .strip()
  .describe("Read live GBLIN treasury state (NAV, supply, Crash Shield status)");
