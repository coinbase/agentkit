import { z } from "zod";

/**
 * Schema for preflight_check — trust-check one absolute https x402 seller URL.
 */
export const PreflightCheckSchema = z
  .object({
    url: z
      .string()
      .url()
      .describe("Absolute https URL of the x402 seller endpoint to trust-check before paying"),
    fresh: z
      .boolean()
      .nullable()
      .optional()
      .describe("When true, force a live probe (skip cache). Defaults to false."),
  })
  .strict()
  .describe("Parameters for x402check preflight_check");

/**
 * Schema for verify_payto — same billing as preflight; focuses on receiving wallet + history.
 */
export const VerifyPayToSchema = z
  .object({
    url: z
      .string()
      .url()
      .describe("Absolute https URL of the x402 seller whose live 402 payTo should be verified"),
    expectedPayTo: z
      .string()
      .nullable()
      .optional()
      .describe(
        "Optional allowlisted payTo. When set, a mismatch becomes verdict caution/avoid signal in the response.",
      ),
    fresh: z
      .boolean()
      .nullable()
      .optional()
      .describe("When true, force a live probe (skip cache). Defaults to false."),
  })
  .strict()
  .describe("Parameters for x402check verify_payto");
