import { z } from "zod";

/**
 * Input schema for getting wallet portfolio.
 */
export const GetWalletPortfolioSchema = z
  .object({
    walletAddress: z
      .string()
      .describe(
        "The wallet address to fetch portfolio for. Defaults is empty string, which will raise an error later if not provided.",
      ),
  })
  .strip()
  .describe("Input schema for fetching wallet portfolio");
