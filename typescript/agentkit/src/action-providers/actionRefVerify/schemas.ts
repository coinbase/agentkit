import { z } from "zod";

/**
 * Input schema for computing an action_ref (action-ref-v1: SHA-256 of RFC
 * 8785 JCS over {agent_id, action_type, scope, timestamp}).
 */
export const ComputeActionRefSchema = z
  .object({
    agentId: z.string().describe("The agent_id preimage field"),
    actionType: z
      .string()
      .describe(
        "The action_type preimage field, e.g. 'agentkit.x402.retry_http_request_with_x402'",
      ),
    scope: z.string().describe("The scope preimage field, e.g. 'base:usdc:pay-and-fetch'"),
    timestamp: z
      .string()
      .describe("RFC 3339 UTC with 3-digit ms precision, e.g. '2026-08-20T22:00:00.000Z'"),
  })
  .strict();

/**
 * Input schema for verifying that an action_ref was anchored on-chain.
 */
export const VerifyAnchorSchema = z
  .object({
    actionRef: z
      .string()
      .regex(/^(0x)?[0-9a-fA-F]{64}$/, "actionRef must be a 32-byte hex string")
      .describe("The action_ref (bytes32 hex, with or without 0x prefix) to check"),
    chain: z
      .enum(["base", "arbitrum", "ink"])
      .default("base")
      .describe("Which deployment of AnchorRegistry to query — same CREATE2 address on all three"),
  })
  .strict();
