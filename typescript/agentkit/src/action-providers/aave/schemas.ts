import { z } from "zod";

/**
 * Input schema for Aave supply action.
 */
export const AaveSupplySchema = z
  .object({
    assetId: z
      .enum(["weth", "usdc", "cbeth", "wsteth", "dai", "usdt"])
      .describe("The asset to supply as collateral"),
    amount: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
      .describe("The amount of tokens to supply in human-readable format"),
  })
  .describe("Input schema for Aave supply action");

/**
 * Input schema for Aave withdraw action.
 */
export const AaveWithdrawSchema = z
  .object({
    assetId: z
      .enum(["weth", "usdc", "cbeth", "wsteth", "dai", "usdt"])
      .describe("The asset to withdraw"),
    amount: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
      .describe("The amount of tokens to withdraw in human-readable format"),
  })
  .describe("Input schema for Aave withdraw action");

/**
 * Input schema for Aave borrow action.
 */
export const AaveBorrowSchema = z
  .object({
    assetId: z
      .enum(["weth", "usdc", "dai", "usdt"])
      .describe("The asset to borrow"),
    amount: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
      .describe("The amount of tokens to borrow in human-readable format"),
    interestRateMode: z
      .enum(["stable", "variable"])
      .default("variable")
      .describe("The interest rate mode: 'stable' or 'variable' (default: variable)"),
  })
  .describe("Input schema for Aave borrow action");

/**
 * Input schema for Aave repay action.
 */
export const AaveRepaySchema = z
  .object({
    assetId: z
      .enum(["weth", "usdc", "dai", "usdt"])
      .describe("The asset to repay"),
    amount: z
      .string()
      .regex(/^\d+(\.\d+)?$/, "Must be a valid integer or decimal value")
      .describe("The amount of tokens to repay in human-readable format"),
    interestRateMode: z
      .enum(["stable", "variable"])
      .default("variable")
      .describe("The interest rate mode of the debt: 'stable' or 'variable'"),
  })
  .describe("Input schema for Aave repay action");

/**
 * Input schema for Aave get user data action.
 */
export const AaveGetUserDataSchema = z
  .object({})
  .describe("Input schema for getting user account data from Aave");

/**
 * Input schema for Aave get reserve data action.
 */
export const AaveGetReserveDataSchema = z
  .object({
    assetId: z
      .enum(["weth", "usdc", "cbeth", "wsteth", "dai", "usdt"])
      .describe("The asset to get reserve data for"),
  })
  .describe("Input schema for getting reserve data from Aave");

