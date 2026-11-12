import { z } from "zod";

/**
 * Configuration for the TolcaActionProvider.
 */
export interface TolcaConfig {
  /**
   * Base URL of the Tolca API. Defaults to https://tolca.tonbot.ca.
   */
  baseUrl?: string;

  /**
   * Highest price, in USDC, the provider will pay for one Tolca call.
   * Defaults to 0.02 (payment-check costs 0.01, sanctions screening 0.005).
   */
  maxPriceUsdc?: number;
}

/**
 * Input schema for checking an x402 seller before paying it.
 */
export const CheckX402SellerSchema = z
  .object({
    url: z
      .string()
      .url()
      .nullable()
      .describe(
        "URL of the x402 endpoint the agent is about to pay. Tolca requests it without paying and reads its 402 payment request. Provide this or paymentRequired.",
      ),
    paymentRequired: z
      .record(z.string(), z.unknown())
      .nullable()
      .describe(
        "The decoded 402 payment request (PAYMENT-REQUIRED header or 402 body) the agent received from the seller. Provide this or url.",
      ),
    sellerName: z
      .string()
      .max(160)
      .nullable()
      .describe(
        "Optional legal name of the company behind the seller, to also screen it against US, UK and EU sanctions lists.",
      ),
  })
  .strip()
  .describe("Check an x402 seller with Tolca payment-check before paying it");

/**
 * Input schema for screening a company or person name against sanctions lists.
 */
export const ScreenSanctionsSchema = z
  .object({
    name: z
      .string()
      .min(2)
      .max(160)
      .describe("Name of the company or person to screen, e.g. 'Acme Trading Ltd.'"),
  })
  .strip()
  .describe("Screen a company or person name against sanctions lists with Tolca");
