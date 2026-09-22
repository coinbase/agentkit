import { z } from "zod";

export const CheckSellerVerdictSchema = z
  .object({
    url: z
      .string()
      .url()
      .describe(
        "The absolute https URL of the x402 endpoint to check before paying.",
      ),
  })
  .describe(
    "Check whether an x402 seller is safe to pay. Returns pay, caution, or avoid with a cryptographic attestation.",
  );

export const GetCensusLeaderboardSchema = z
  .object({})
  .describe(
    "Get the top-scoring x402 sellers from the live census — endpoints with the highest trust scores and real buyer activity.",
  );

export interface X402GuardConfig {
  gateway?: string;
}
