import { z } from "zod";

export const SearchDexScreenerPairsSchema = z
  .object({
    query: z
      .string()
      .min(1)
      .describe(
        "Search query to find DEX pairs. Can be a token name, symbol, or contract address. " +
          "Examples: 'USDC', 'ETH', '0x4200000000000000000000000000000000000006'.",
      ),
  })
  .strict();

export const GetDexScreenerPairsByTokenSchema = z
  .object({
    chainId: z
      .string()
      .describe(
        "The blockchain identifier. Examples: 'base', 'ethereum', 'solana', 'arbitrum', 'polygon'. " +
          "Use 'base' for Base network tokens.",
      ),
    tokenAddress: z
      .string()
      .describe(
        "The contract address of the token to fetch pairs for. " +
          "Example: '0x4200000000000000000000000000000000000006' for WETH on Base.",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(5)
      .describe(
        "Maximum number of pairs to return, ordered by 24h volume. Defaults to 5, maximum 20.",
      ),
  })
  .strict();

export const GetDexScreenerPairSchema = z
  .object({
    chainId: z
      .string()
      .describe(
        "The blockchain identifier. Examples: 'base', 'ethereum', 'solana', 'arbitrum', 'polygon'.",
      ),
    pairAddress: z
      .string()
      .describe(
        "The contract address of the DEX pair to fetch. " +
          "Example: '0x88A43bbDF9D098eEC7bCEda4e2494615dfD9bB9C'.",
      ),
  })
  .strict();
