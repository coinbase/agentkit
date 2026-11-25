import { z } from "zod";
import { SBOR_BENCHMARKS } from "./constants";

/**
 * Input schema for getting the current SBOR fixing.
 */
export const GetSborRateSchema = z
  .object({
    benchmark: z
      .enum(SBOR_BENCHMARKS)
      .nullable()
      .describe(
        "SBOR-USD, SBOR-BTC or SBOR-STX for lending on Stacks, or BTC-COLLATERAL-USDC for borrowing USDC against bitcoin on Base and Ethereum. Null for all of them.",
      ),
  })
  .strict();

/**
 * Input schema for comparing an offered rate against an SBOR benchmark.
 */
export const CompareRateToSborSchema = z
  .object({
    rate: z
      .number()
      .gt(0)
      .lte(100)
      .describe("The offered rate as an annual percentage: 4.2 means 4.2%, not 0.042."),
    side: z
      .enum(["borrow", "supply"])
      .describe("Whether the agent would be borrowing or supplying at this rate."),
    benchmark: z
      .enum(SBOR_BENCHMARKS)
      .describe(
        "The benchmark to compare against. For USDC borrowed against cbBTC or WBTC on Base or Ethereum, use BTC-COLLATERAL-USDC. For lending on Stacks, use the index for the currency.",
      ),
  })
  .strict();

/**
 * Input schema for listing the markets behind an SBOR benchmark.
 */
export const ListSborMarketsSchema = z
  .object({
    benchmark: z
      .enum(SBOR_BENCHMARKS)
      .nullable()
      .describe("The benchmark whose markets to list. Null for the three Stacks indices."),
  })
  .strict();
