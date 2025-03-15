import { z } from "zod";

/**
 * Input schema for submitting a research question to Messari AI.
 */
export const MessariResearchQuestionSchema = z
  .object({
    question: z
      .string()
      .min(1, "Research question is required.")
      .describe("The research question about crypto markets, protocols, or tokens"),
  })
  .strip()
  .describe("Input schema for submitting a research question to Messari AI");
