import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { VerifyReasoningSchema } from "./schemas";
import { THOUGHTPROOF_API_BASE_URL } from "./constants";

/**
 * ThoughtProofActionProvider is an action provider for reasoning verification.
 * Runs adversarial multi-model critique (Claude + Grok + DeepSeek) on any claim
 * before the agent executes it. Returns ALLOW or HOLD with a signed attestation.
 *
 * Uses x402 micropayments on Base (USDC). No API key required.
 * Docs: https://thoughtproof.ai/skill.md
 */
export class ThoughtProofActionProvider extends ActionProvider {
  constructor() {
    super("thoughtproof", []);
  }

  /**
   * Verifies a claim or decision using adversarial multi-model reasoning.
   * Call this before executing high-stakes or irreversible actions.
   *
   * @param args - The verification parameters (claim, stakeLevel, domain)
   * @returns Verification result with verdict (ALLOW/HOLD), confidence, and objections
   */
  @CreateAction({
    name: "verify_reasoning",
    description:
      "Verify a claim or decision using adversarial multi-model reasoning before executing. " +
      "Returns ALLOW or HOLD with confidence score and key objections. " +
      "Use before irreversible actions, large transactions, or high-stakes decisions.",
    schema: VerifyReasoningSchema,
  })
  async verifyReasoning(args: z.infer<typeof VerifyReasoningSchema>): Promise<string> {
    try {
      const response = await fetch(`${THOUGHTPROOF_API_BASE_URL}/v1/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          claim: args.claim,
          stakeLevel: args.stakeLevel ?? "medium",
          domain: args.domain ?? "financial",
        }),
      });

      if (!response.ok) {
        return `ThoughtProof verification failed: HTTP ${response.status}. Proceed with caution.`;
      }

      const data = await response.json();
      const verdict = data.verdict ?? "UNCERTAIN";
      const confidence = data.confidence ?? 0;
      const objections = data.objections ?? [];

      if (verdict === "ALLOW") {
        return (
          `✅ ThoughtProof: ALLOW (confidence: ${confidence}%)\n` +
          (objections.length > 0 ? `Minor concerns: ${objections.join("; ")}` : "No objections raised.")
        );
      } else {
        return (
          `🚫 ThoughtProof: HOLD — do not proceed.\n` +
          `Confidence: ${confidence}%\n` +
          `Objections:\n${objections.map((o: string) => `- ${o}`).join("\n")}`
        );
      }
    } catch (error) {
      return `🚫 ThoughtProof: HOLD — verification service unavailable (${error}). Do not proceed until reasoning can be verified.`;
    }
  }

  supportsNetwork = () => true;
}

export const thoughtproofActionProvider = () => new ThoughtProofActionProvider();
