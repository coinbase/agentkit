import { z } from "zod";

/**
 * Input schema for giving feedback to an agent.
 *
 * The value + valueDecimals pair represents a signed fixed-point number (int128).
 * Examples from ERC-8004 spec:
 *   - Quality rating 87/100: value=87, valueDecimals=0, tag1="starred"
 *   - Uptime 99.77%: value=9977, valueDecimals=2, tag1="uptime"
 *   - Response time 560ms: value=560, valueDecimals=0, tag1="responseTime"
 *   - Trading yield -3.2%: value=-32, valueDecimals=1, tag1="tradingYield"
 *
 * Core feedback data is always stored onchain. When IPFS is configured, an off-chain feedback file (e.g. comment) is also uploaded.
 */
export const GiveFeedbackSchema = z
  .object({
    agentId: z.string().describe("The agent ID to give feedback for"),
    value: z
      .number()
      .int()
      .describe(
        "The feedback value as a signed integer (int128). Combined with valueDecimals to form a fixed-point number. Examples: 87 with decimals=0 (rating 87/100), 9977 with decimals=2 (99.77%), 560 (560ms), -32 with decimals=1 (-3.2%)",
      ),
    valueDecimals: z
      .number()
      .int()
      .min(0)
      .max(18)
      .nullish()
      .transform(val => val ?? 0)
      .optional()
      .describe(
        "Number of decimal places for the value (0-18, default: 0). E.g., valueDecimals=2 means value=9977 represents 99.77",
      ),
    tag1: z
      .string()
      .max(50)
      .nullish()
      .transform(val => val ?? "starred")
      .optional()
      .describe(
        "Primary category tag indicating what is being measured. Examples: 'starred' (quality 0-100), 'reachable' (binary 0/1), 'uptime' (%), 'successRate' (%), 'responseTime' (ms), 'revenues' (USD), 'tradingYield' (%). Defaults to 'starred'.",
      ),
    tag2: z
      .string()
      .max(50)
      .nullish()
      .transform(val => val ?? "")
      .optional()
      .describe(
        "Secondary category tag for more specific categorization (e.g., 'day', 'week', 'month' for yield periods)",
      ),
    endpoint: z
      .string()
      .max(2048)
      .nullish()
      .transform(v => (v == null || v === "" ? undefined : v))
      .optional()
      .describe(
        "Optional endpoint URI stored on-chain with this feedback (e.g. the MCP or A2A URL you used)",
      ),
    comment: z
      .string()
      .max(500)
      .nullish()
      .transform(v => (v == null ? undefined : v))
      .optional()
      .describe("Optional user review comment (max 500 characters)"),
    a2aTaskId: z
      .string()
      .nullish()
      .transform(v => (v == null ? undefined : v))
      .optional()
      .describe("Optional A2A task ID this feedback refers to (stored in off-chain feedback file)"),
    a2aContextId: z
      .string()
      .nullish()
      .transform(v => (v == null ? undefined : v))
      .optional()
      .describe("Optional A2A context ID for the conversation (stored in off-chain feedback file)"),
    a2aSkills: z
      .array(z.string())
      .nullish()
      .transform(v => (v == null ? undefined : v))
      .optional()
      .describe("Optional A2A skills used in the interaction (stored in off-chain feedback file)"),
  })
  .strip()
  .describe("Submits feedback for an agent on the ERC-8004 Reputation Registry.");

/**
 * Input schema for revoking feedback.
 */
export const RevokeFeedbackSchema = z
  .object({
    agentId: z.string().describe("The agent ID the feedback was given to"),
    feedbackIndex: z
      .string()
      .describe("The index of the feedback to revoke (from when you gave it)"),
  })
  .strip()
  .describe("Revokes previously submitted feedback");

/**
 * Input schema for appending a response to feedback.
 * Anyone can append responses (e.g., agent owner showing a refund, data intelligence aggregators tagging spam).
 */
export const AppendResponseSchema = z
  .object({
    agentId: z.string().describe("The agent ID that received the feedback"),
    clientAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The address of the client who gave the feedback"),
    feedbackIndex: z.string().describe("The index of the feedback to respond to"),
    responseUri: z.string().describe("URI to the response content (e.g., ipfs://Qm... link)"),
    responseHash: z
      .string()
      .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid bytes32 hash format")
      .nullish()
      .transform(v => (v == null ? undefined : v))
      .optional()
      .describe(
        "Optional KECCAK-256 hash of the responseUri content for integrity verification. Not required for IPFS URIs (content-addressed).",
      ),
  })
  .strip()
  .describe(
    "Appends a response to feedback. Anyone can respond (agent owners, data aggregators, etc.)",
  );

/**
 * Input schema for getting an agent's feedback entries.
 * Uses the agent0 SDK's indexed subgraph for fast queries.
 */
export const GetAgentFeedbackSchema = z
  .object({
    agentId: z
      .string()
      .describe("The agent ID to get feedback for (format: agentId or chainId:agentId)"),
    reviewerAddresses: z
      .array(z.string())
      .nullish()
      .transform(v => (v == null ? undefined : v))
      .optional()
      .describe("Filter by reviewer wallet addresses"),
    minValue: z
      .number()
      .nullish()
      .transform(v => (v == null ? undefined : v))
      .optional()
      .describe("Minimum feedback value"),
    maxValue: z
      .number()
      .nullish()
      .transform(v => (v == null ? undefined : v))
      .optional()
      .describe("Maximum feedback value"),
    tag1: z
      .string()
      .nullish()
      .transform(v => (v == null ? undefined : v))
      .optional()
      .describe("Filter by primary tag"),
    includeRevoked: z
      .boolean()
      .nullish()
      .transform(val => val ?? false)
      .optional()
      .describe("Include revoked feedback entries (default: false)"),
    pageSize: z
      .number()
      .min(1)
      .max(50)
      .nullish()
      .transform(val => val ?? 20)
      .optional()
      .describe("Number of results per page (default: 20)"),
  })
  .strip()
  .describe("Gets feedback entries for an agent with optional filters");
