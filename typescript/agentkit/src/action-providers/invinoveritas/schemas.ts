import { z } from "zod";

/**
 * Artifact types the /review endpoint specializes on. `trade` triggers a
 * capital-scale-aware risk review; `onchain_action` triggers deterministic
 * scam / drainer / unlimited-approval / address-poisoning checks;
 * `sanctions_screening` triggers overclaim-boundary checks on a compliance verdict.
 */
export const ARTIFACT_TYPES = [
  "code_diff",
  "patch",
  "shell_command",
  "plan",
  "config_change",
  "analysis",
  "agent_output",
  "trade",
  "onchain_action",
  "sanctions_screening",
  "general",
] as const;

export const ReviewSchema = z
  .object({
    artifact: z
      .string()
      .min(1)
      .max(20000)
      .describe(
        "The proposed action to review BEFORE you execute it: a trade, a prepared on-chain transaction, a plan, a code diff, a shell command, or an agent output.",
      ),
    artifactType: z
      .enum(ARTIFACT_TYPES)
      .optional()
      .describe(
        "Tailors the review. Use 'trade' for a proposed entry/exit (capital-scale-aware risk review), 'onchain_action' for a prepared transaction (deterministic scam/drainer/approval/poisoning checks), or 'sanctions_screening' for a compliance verdict. Defaults to 'general'.",
      ),
    context: z
      .string()
      .max(8000)
      .optional()
      .describe("Optional: what you are doing and why — improves the verdict."),
    sign: z
      .boolean()
      .optional()
      .describe(
        "If true, also returns a portable signed proof of this verdict that anyone can recompute (POST /verify-proof or NIP-01) without trusting you or us. Attach it to whatever you ship.",
      ),
  })
  .strip()
  .describe("Input schema for requesting an independent pre-action verdict from invinoveritas");

export const VerifyProofSchema = z
  .object({
    event: z
      .record(z.string(), z.any())
      .optional()
      .describe(
        "The signed proof object {id,pubkey,created_at,kind,tags,content,sig} another agent handed you (from their /review sign=true or /prove response). Trustless path — verified locally against the published key.",
      ),
    proofId: z
      .string()
      .optional()
      .describe("Alternatively, a stored attestation proof_id to fetch and verify."),
  })
  .strip()
  .describe("Input schema for verifying a signed invinoveritas proof, free and no auth");
