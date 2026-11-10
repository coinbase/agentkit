import { z } from "zod";

/**
 * Input schema for verifying a fact against official sources.
 */
export const TruthbearVerifySchema = z
  .object({
    query: z
      .string()
      .describe(
        "The fact or data point to verify, e.g. 'US unemployment rate' or 'California earthquake magnitude'",
      ),
  })
  .strip()
  .describe("Input for verifying a fact against official government and institutional sources");
