import { z } from "zod";

export const ListVaultsSchema = z
  .object({
    chain: z
      .string()
      .optional()
      .describe("Filter by chain name or ID (e.g. 'ethereum', 'base', '8453')"),
    userAddress: z
      .string()
      .optional()
      .describe("EVM wallet address to include token balances for each deposit token"),
  })
  .strict()
  .describe("Parameters for listing available ATV yield vaults");

export const GetVaultNavSchema = z
  .object({
    address: z.string().describe("Vault contract address"),
  })
  .strict()
  .describe("Parameters for getting vault NAV price");

export const GetVaultTvlSchema = z
  .object({
    address: z.string().describe("Vault contract address"),
  })
  .strict()
  .describe("Parameters for getting vault TVL");

export const GetVaultApySchema = z
  .object({
    address: z.string().describe("Vault contract address"),
  })
  .strict()
  .describe("Parameters for getting vault APY");

export const BuildDepositTxSchema = z
  .object({
    userAddress: z.string().describe("EVM address of the depositor"),
    vaultAddress: z.string().describe("Vault contract address"),
    depositTokenAddress: z.string().describe("ERC-20 token address to deposit"),
    depositAmount: z
      .string()
      .describe("Human-readable deposit amount (e.g. '100' for 100 USDC)"),
  })
  .strict()
  .describe("Parameters for building a vault deposit transaction");

export const BuildWithdrawTxSchema = z
  .object({
    userAddress: z.string().describe("EVM address of the withdrawer"),
    vaultAddress: z.string().describe("Vault contract address"),
    oTokenAddress: z.string().describe("Output token address to receive"),
    sharesToWithdraw: z
      .string()
      .describe("Human-readable share amount to withdraw (e.g. '100')"),
    slippage: z
      .string()
      .optional()
      .describe("Slippage tolerance as a percentage (e.g. '0.5' for 0.5%)"),
  })
  .strict()
  .describe("Parameters for building a vault withdraw transaction");
