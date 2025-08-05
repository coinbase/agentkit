import { z } from "zod";

/**
 * Input schema for getting wallet portfolio.
 */
export const GetWalletPortfolioSchema = z
  .object({
    walletAddress: z
      .string()
      .describe(
        "The wallet address to fetch portfolio for (defaults to connected wallet if not provided)",
      ),
  })
  .strip()
  .describe("Input schema for fetching wallet portfolio");
