import { z } from "zod";

/**
 * Input schema for CanaryGuard prompt-injection sanitization.
 */
export const CanaryGuardSanitizeSchema = z
  .object({
    content: z
      .string()
      .min(1)
      .max(50_000)
      .describe("Untrusted text, scraped HTML, email, or third-party tool output to sanitize before placing into agent context (max 50,000 characters)"),
    strict_mode: z
      .boolean()
      .optional()
      .default(true)
      .describe("When true (default), completely blocks detected instruction overrides and wallet-draining commands"),
  })
  .strip()
  .describe("Input arguments for CanaryGuard prompt-injection sanitization");
