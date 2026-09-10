import { z } from "zod";

/**
 * Chain selector shared by every NodeFlare action. Accepts a slug, a common
 * name, or a numeric chain ID so the model doesn't need to know NodeFlare's
 * internal slugs.
 */
const chainField = z
  .string()
  .describe(
    "Chain to query: a slug (eth, base, arb, op, robinhood…), a common name (ethereum, arbitrum, bsc), or a numeric chain ID (1, 8453). Call get_supported_chains for the full list.",
  );

/**
 * Input schema for listing NodeFlare's supported chains.
 */
export const GetSupportedChainsSchema = z
  .object({})
  .describe("Input schema for listing the EVM chains NodeFlare serves");

/**
 * Input schema for fetching the latest block number.
 */
export const GetBlockNumberSchema = z
  .object({ chain: chainField })
  .describe("Input schema for fetching the latest block number on a chain");

/**
 * Input schema for fetching a native-token balance.
 */
export const GetNativeBalanceSchema = z
  .object({
    chain: chainField,
    address: z.string().describe("The 0x address to check the native balance of"),
  })
  .describe("Input schema for fetching a native-token balance");

/**
 * Input schema for fetching an ERC-20 token balance.
 */
export const GetErc20BalanceSchema = z
  .object({
    chain: chainField,
    tokenAddress: z.string().describe("The ERC-20 token contract address"),
    address: z.string().describe("The holder 0x address whose balance to read"),
  })
  .describe("Input schema for fetching an ERC-20 token balance");

/**
 * Input schema for fetching ERC-20 token metadata.
 */
export const GetTokenMetadataSchema = z
  .object({
    chain: chainField,
    tokenAddress: z.string().describe("The ERC-20 token contract address"),
  })
  .describe("Input schema for fetching ERC-20 token metadata");

/**
 * Input schema for fetching the current gas price.
 */
export const GetGasPriceSchema = z
  .object({ chain: chainField })
  .describe("Input schema for fetching the current gas price on a chain");

/**
 * Input schema for looking up a transaction by hash.
 */
export const GetTransactionSchema = z
  .object({
    chain: chainField,
    txHash: z.string().describe("The 0x transaction hash to look up"),
  })
  .describe("Input schema for looking up a transaction by hash");

/**
 * Input schema for reading native + ERC-20 balances across many chains.
 */
export const GetMultichainBalancesSchema = z
  .object({
    address: z.string().describe("The 0x address to look up balances for"),
    chains: z
      .array(z.string())
      .optional()
      .describe("Chains to include (slug, name, or chain ID); defaults to all 23"),
    tokens: z
      .record(z.string(), z.array(z.string()))
      .optional()
      .describe("ERC-20 contract addresses per chain, e.g. { base: [\"0x833589...\"] }"),
  })
  .describe("Input schema for reading native + ERC-20 balances across many EVM chains");
