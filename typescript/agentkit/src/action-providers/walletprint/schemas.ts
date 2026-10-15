import { z } from "zod";

/**
 * Input schema for WalletPrint score_transaction action.
 */
export const ScoreTransactionSchema = z
  .object({
    to: z
      .string()
      .describe("The recipient address of the proposed transaction (0x-prefixed hex address)"),
    value_usd: z
      .number()
      .positive()
      .describe("The USD value of the proposed transaction"),
    asset: z
      .string()
      .describe('The asset being transferred (e.g. "USDC", "ETH", "WBTC")'),
    contract_category: z
      .string()
      .optional()
      .describe(
        'Optional category of the contract being called (e.g. "erc20", "defi", "bridge", "nft")',
      ),
  })
  .strict();
