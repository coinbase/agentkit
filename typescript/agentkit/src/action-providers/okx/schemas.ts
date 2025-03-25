import { z } from "zod";

/**
 * Input schema for getting a swap quote from OKX DEX.
 */
export const OKXDexQuoteSchema = z
  .object({
    chainId: z
      .string()
      .describe("Blockchain network ID (e.g., '1' for Ethereum mainnet, '56' for BSC)"),
    
    fromTokenAddress: z
      .string()
      .describe("Source token contract address (use 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE for native token)"),
    
    toTokenAddress: z
      .string()
      .describe("Destination token contract address"),
    
    amount: z
      .string()
      .describe("Amount of source token in wei format (with all decimals)"),
    
    slippage: z
      .string()
      .describe("Maximum acceptable slippage percentage (e.g., '0.5' for 0.5%)")
      .optional()
      .default("0.5"),
    
    // Additional optional parameters
    userAddress: z
      .string()
      .describe("User wallet address for quotes that require it")
      .optional(),
    
    excludeDexes: z
      .array(z.string())
      .describe("List of DEXes to exclude from routing")
      .optional(),
    
    includeDexes: z
      .array(z.string())
      .describe("List of DEXes to include in routing (if provided, only these will be used)")
      .optional(),
  })
  .describe("Input schema for fetching swap quotes from OKX DEX");

/**
 * Input schema for executing a swap on OKX DEX.
 * This will be implemented in future versions.
 */
export const OKXDexSwapSchema = z
  .object({
    chainId: z.string().describe("Blockchain network ID"),
    quoteId: z.string().describe("Quote ID from a previous getQuote call"),
    userAddress: z.string().describe("User wallet address that will execute the swap"),
    // Additional parameters to be added based on OKX DEX swap requirements
  })
  .describe("Input schema for executing token swaps via OKX DEX");