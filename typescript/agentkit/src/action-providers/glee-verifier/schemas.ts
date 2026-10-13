import { z } from "zod";

/**
 * Schema for an assertion rule in GLEE patch verification.
 */
export const AssertionSchema = z
  .object({
    type: z.enum(["contains", "prohibits"]).describe("Assertion type: contains or prohibits"),
    pattern: z.string().describe("Pattern to search for in the patch content"),
    message: z.string().optional().describe("Optional error message emitted when the assertion fails"),
  })
  .describe("Assertion rule for diff verification");

/**
 * Schema for path safety policy in GLEE patch verification.
 */
export const PathPolicySchema = z
  .object({
    allowed_paths: z
      .array(z.string())
      .optional()
      .describe("List of allowed path prefixes; modifications outside are rejected"),
    banned_paths: z
      .array(z.string())
      .optional()
      .describe("List of forbidden path prefixes; modifications inside are rejected"),
  })
  .describe("Path policy constraints for patch verification");

/**
 * Input schema for verifying a patch via GLEE Acceptance Verifier.
 */
export const VerifyPatchSchema = z
  .object({
    patch: z.string().describe("Unified git diff patch content to verify"),
    path_policy: PathPolicySchema.optional().describe("Path safety policy constraints"),
    assertions: z.array(AssertionSchema).optional().describe("Content assertions to enforce"),
    job_id: z.string().optional().describe("Optional tracking job ID echoed in signed receipt"),
  })
  .strip()
  .describe("Instructions for verifying a git diff patch against security and content constraints");
