import { z } from "zod";

/**
 * Action schemas for the USDCtoFiat / Galleon offramp action provider.
 */

export const CashoutActionSchema = z.object({
  mode: z
    .enum(["fast", "best"])
    .describe(
      "fast: live market pricing with 0% spread. best: Delegate-managed pricing with a 10 bps fee.",
    ),
  amount: z
    .string()
    .min(1)
    .describe("Human USDC amount to sell, for example \"100\"."),
  currency: z
    .string()
    .min(1)
    .describe("Fiat currency code, for example USD, EUR, or GBP."),
  platform: z
    .string()
    .min(1)
    .describe("Payment platform id from the SDK, for example revolut or venmo."),
  payee: z
    .string()
    .min(1)
    .describe("Payout identifier on that platform, for example a Revolut username."),
});
