import { z } from "zod";

/**
 * Input schema for creating an identity proof.
 */
export const CreateIdentityProofSchema = z
  .object({
    permissions: z
      .array(z.string())
      .min(1)
      .describe(
        "Permissions to include in the credential (e.g., 'read_data', 'financial_small', 'write_data')",
      ),
    expirySeconds: z
      .number()
      .int()
      .positive()
      .default(3600)
      .describe("How long the credential is valid, in seconds (default: 3600)"),
  })
  .strip()
  .describe("Creates a ZKP identity proof for this agent with scoped permissions.");

/**
 * Input schema for verifying another agent's identity proof.
 */
export const VerifyIdentityProofSchema = z
  .object({
    proofEnvelope: z
      .string()
      .min(1)
      .describe(
        "The proof envelope JSON string (application/vnd.bolyra.proof+json) from another agent",
      ),
    requiredPermissions: z
      .array(z.string())
      .optional()
      .describe(
        "Permissions the other agent must hold for verification to pass (optional — omit to just check validity)",
      ),
  })
  .strip()
  .describe("Verifies another agent's Bolyra identity proof envelope.");

/**
 * Input schema for delegating capabilities to a sub-agent.
 */
export const DelegateCapabilitySchema = z
  .object({
    delegateeId: z
      .string()
      .min(1)
      .describe("Identifier (address or DID) of the agent receiving delegated permissions"),
    permissions: z
      .array(z.string())
      .min(1)
      .describe(
        "Permissions to delegate — must be a subset of the delegator's own permissions",
      ),
    expirySeconds: z
      .number()
      .int()
      .positive()
      .default(900)
      .describe("How long the delegation is valid, in seconds (default: 900)"),
  })
  .strip()
  .describe(
    "Delegates a narrowed set of permissions to another agent. The delegatee can never hold more permissions than the delegator.",
  );
