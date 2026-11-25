import { z } from "zod";

/**
 * Input schema for the Deal Verdict pre-checkout check.
 */
export const CheckDealSchema = z
  .object({
    product: z
      .string()
      .min(1)
      .max(300)
      .describe("The product name (or product page URL) whose price should be checked"),
    price: z.number().positive().describe("The price the agent found for this product, in USD"),
    compareAtPrice: z
      .number()
      .positive()
      .optional()
      .describe("Optional claimed original ('was') price, used to detect fake discounts"),
    url: z
      .string()
      .url()
      .optional()
      .describe("Optional product page URL where the price was found"),
  })
  .strict();

/**
 * Configuration for DealVerdictActionProvider.
 */
export const DealVerdictConfigSchema = z
  .object({
    url: z
      .string()
      .url()
      .optional()
      .describe("Deal Verdict endpoint URL (defaults to the production endpoint)"),
    maxPaymentUsdc: z
      .number()
      .positive()
      .max(0.01)
      .optional()
      .describe("Hard cap for a single check, in USDC. Cannot exceed the $0.01 endpoint price."),
  })
  .strict();

export type DealVerdictConfig = z.infer<typeof DealVerdictConfigSchema>;
