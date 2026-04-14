import { z } from "zod";

/**
 * Input schema for Clicks Protocol quick start action.
 */
export const ClicksQuickStartSchema = z
  .object({
    amount: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
      .describe("The amount of USDC to deposit during quick start, in whole units (e.g. '100' for 100 USDC)"),
  })
  .describe("Input schema for Clicks Protocol quick start action");

/**
 * Input schema for Clicks Protocol deposit action.
 */
export const ClicksDepositSchema = z
  .object({
    amount: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
      .describe("The amount of USDC to deposit into yield, in whole units (e.g. '50' for 50 USDC)"),
  })
  .describe("Input schema for Clicks Protocol deposit action");

/**
 * Input schema for Clicks Protocol withdraw action.
 */
export const ClicksWithdrawSchema = z
  .object({
    amount: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
      .describe("The amount of USDC to withdraw from yield, in whole units (e.g. '50' for 50 USDC)"),
  })
  .describe("Input schema for Clicks Protocol withdraw action");

/**
 * Input schema for Clicks Protocol get info action.
 */
export const ClicksGetInfoSchema = z
  .object({})
  .describe("Input schema for Clicks Protocol get agent info action");
