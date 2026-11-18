import { z } from "zod";

export const VerifyReasoningSchema = z
  .object({
    claim: z
      .string()
      .describe("The claim, decision, or action to verify (e.g. 'Swap 100 USDC for TOKEN_X at market price')"),
    stakeLevel: z
      .enum(["low", "medium", "high", "critical"])
      .describe("The stakes of the decision. Use 'high' or 'critical' for transactions above $1000 or irreversible actions."),
    domain: z
      .enum(["financial", "security", "legal", "medical", "general"])
      .optional()
      .describe("The domain of the claim. Defaults to 'financial' for DeFi actions."),
  })
  .strip()
  .describe("Input schema for verifying a reasoning claim before executing an action");
