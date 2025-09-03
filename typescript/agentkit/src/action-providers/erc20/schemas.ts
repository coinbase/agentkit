import { z } from "zod";

/**
 * Input schema for transfer action.
 */
export const TransferSchema = z
  .object({
    amount: z.string().describe("The amount of the asset to transfer in whole units (e.g. 1.5 USDC)"),
    tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")  
    .describe("The contract address of the token to transfer"),
    destinationAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")  
    .describe("The destination to transfer the funds"),
  })
  .strip()
  .describe("Instructions for transferring assets");

/**
 * Input schema for get balance action.
 */
export const GetBalanceSchema = z
  .object({
    tokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")  
      .describe("The contract address of the ERC20 token to get the balance for"),
    address: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")  
      .optional()
      .describe("The address to check the balance for. If not provided, uses the wallet's address"),
  })
  .strip()
  .describe("Instructions for getting wallet balance");

/**
 * Input schema for get token address action.
 */
export const GetTokenAddressSchema = z
  .object({
    symbol: z
      .string()
      .min(1)
      .toUpperCase()
      .describe("The token symbol (e.g., USDC, WETH, DEGEN)"),
  })
  .strip()
  .describe("Instructions for getting a token's contract address by symbol");
