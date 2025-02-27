import { z } from "zod";

/**
 * Input schema for Compound supply action.
 */
export const CompoundSupplySchema = z
  .object({
    assetId: z.enum(["weth", "cbeth", "cbbtc", "wsteth", "usdc"]).describe("The asset to supply"),
    amount: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
      .describe("The amount of tokens to supply in human-readable format"),
  })
  .describe("Input schema for Compound supply action");

/**
 * Input schema for Compound withdraw action.
 */
export const CompoundWithdrawSchema = z
  .object({
    assetId: z.enum(["weth", "cbeth", "cbbtc", "wsteth", "usdc"]).describe("The asset to withdraw"),
    amount: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
      .describe("The amount of tokens to withdraw in human-readable format"),
  })
  .describe("Input schema for Compound withdraw action");

/**
 * Input schema for Compound borrow action.
 */
export const CompoundBorrowSchema = z
  .object({
    assetId: z.enum(["weth", "usdc"]).describe("The asset to borrow"),
    amount: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
      .describe("The amount of base tokens to borrow in human-readable format"),
  })
  .describe("Input schema for Compound borrow action");

/**
 * Input schema for Compound repay action.
 */
export const CompoundRepaySchema = z
  .object({
    assetId: z.enum(["weth", "usdc"]).describe("The asset to repay"),
    amount: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
      .describe("The amount of tokens to repay in human-readable format"),
  })
  .describe("Input schema for Compound repay action");

/**
 * Input schema for Compound get portfolio action.
 */
export const CompoundPortfolioSchema = z
  .object({})
  .describe("Input schema for Compound get portfolio action");
