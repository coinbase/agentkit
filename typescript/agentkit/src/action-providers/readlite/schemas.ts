import { z } from "zod";

/**
 * Input schema for the Read Lite page read.
 */
export const ReadUrlLiteSchema = z
  .object({
    url: z
      .string()
      .url("url must be a valid URL")
      .describe("The web page URL to fetch and convert to clean Markdown"),
  })
  .strict();

/**
 * Configuration for ReadLiteActionProvider.
 */
export const ReadLiteConfigSchema = z
  .object({
    url: z
      .string()
      .url()
      .optional()
      .describe("Read Lite endpoint URL (defaults to the production endpoint)"),
    maxPaymentUsdc: z
      .number()
      .positive()
      .max(0.005)
      .optional()
      .describe("Hard cap for a single read, in USDC. Cannot exceed the $0.005 endpoint price."),
  })
  .strict();

export type ReadLiteConfig = z.infer<typeof ReadLiteConfigSchema>;
