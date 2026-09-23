import { z } from "zod";

/**
 * Input schema for analyzing seller policies.
 */
export const PolicyCheckAnalyzeSchema = z
  .object({
    policyText: z
      .string()
      .min(50)
      .max(100_000)
      .optional()
      .describe(
        "The full text of the seller's return policy, shipping policy, warranty, or terms of service to analyze. When sellerUrl is also supplied, it is context only.",
      ),
    sellerUrl: z
      .string()
      .optional()
      .describe(
        "The URL of the e-commerce store to check (e.g., 'https://example-store.com'). The service will find and analyze the seller's policies automatically. If policyText is provided, that text takes precedence.",
      ),
  })
  .strict()
  .refine(data => data.policyText || data.sellerUrl, {
    message: "Either policyText or sellerUrl must be provided",
  });

/**
 * Input schema for quick URL-based seller check.
 */
export const PolicyCheckUrlSchema = z
  .object({
    sellerUrl: z
      .string()
      .describe(
        "The URL of the e-commerce store to check (e.g., 'https://example-store.com'). The service will find and analyze the seller's policies automatically.",
      ),
  })
  .strict();
