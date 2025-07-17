import { z } from "zod";

/**
 * Action schemas for the zerion action provider.
 *
 * This file contains the Zod schemas that define the shape and validation
 * rules for action parameters in the zerion action provider.
 */

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
