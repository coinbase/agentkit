import { z } from "zod";

/**
 * MCP context schema for feedback
 */
const McpContextSchema = z
  .object({
    tool: z.string().optional().describe("The MCP tool name being rated"),
    prompt: z.string().optional().describe("The MCP prompt name being rated"),
    resource: z.string().optional().describe("The MCP resource name being rated"),
  })
  .optional()
  .describe("MCP-specific context for the feedback");

/**
 * A2A context schema for feedback
 */
const A2aContextSchema = z
  .object({
    skills: z.array(z.string()).optional().describe("A2A skill identifiers"),
    contextId: z.string().optional().describe("A2A context identifier"),
    taskId: z.string().optional().describe("A2A task identifier"),
  })
  .optional()
  .describe("A2A-specific context for the feedback");

/**
 * OASF context schema for feedback
 */
const OasfContextSchema = z
  .object({
    skills: z.array(z.string()).optional().describe("OASF skill identifiers"),
    domains: z.array(z.string()).optional().describe("OASF domain identifiers"),
  })
  .optional()
  .describe("OASF-specific context for the feedback");

/**
 * Proof of payment schema for feedback (e.g., x402)
 */
const ProofOfPaymentSchema = z
  .object({
    fromAddress: z.string().describe("The address that sent payment"),
    toAddress: z.string().describe("The address that received payment"),
    chainId: z.string().describe("The chain ID where payment occurred"),
    txHash: z.string().describe("The transaction hash of the payment"),
  })
  .optional()
  .describe("Proof of payment context (e.g., for x402)");

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
 * Feedback is automatically uploaded to IPFS and the URI + hash are included onchain.
 */
export const GiveFeedbackSchema = z
  .object({
    agentId: z.string().describe("The agent ID to give feedback for"),
    value: z
      .number()
      .int()
      .describe(
        "The feedback value as a signed integer (int128). Combined with valueDecimals to form a fixed-point number. Examples: 87 (rating 87/100), 9977 with decimals=2 (99.77%), 560 (560ms), -32 with decimals=1 (-3.2%)",
      ),
    valueDecimals: z
      .number()
      .int()
      .min(0)
      .max(18)
      .optional()
      .default(0)
      .describe(
        "Number of decimal places for the value (0-18, default: 0). E.g., valueDecimals=2 means value=9977 represents 99.77",
      ),
    tag1: z
      .string()
      .max(50)
      .optional()
      .default("")
      .describe(
        "Primary category tag indicating what is being measured. Examples: 'starred' (quality 0-100), 'reachable' (binary 0/1), 'uptime' (%), 'successRate' (%), 'responseTime' (ms), 'revenues' (USD), 'tradingYield' (%)",
      ),
    tag2: z
      .string()
      .max(50)
      .optional()
      .default("")
      .describe(
        "Secondary category tag for more specific categorization (e.g., 'day', 'week', 'month' for yield periods)",
      ),
    endpoint: z
      .string()
      .max(200)
      .optional()
      .default("")
      .describe(
        "The endpoint or service being rated (e.g., '/api/v1/chat', 'https://agent.example.com/GetPrice')",
      ),
    mcp: McpContextSchema,
    a2a: A2aContextSchema,
    oasf: OasfContextSchema,
    proofOfPayment: ProofOfPaymentSchema,
    comment: z
      .string()
      .max(500)
      .optional()
      .describe("Optional user review comment (max 500 characters)"),
  })
  .strip()
  .describe(
    "Submits feedback for an agent on the ERC-8004 Reputation Registry. Feedback file is automatically uploaded to IPFS.",
  );

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
 * Input schema for getting reputation summary.
 * Per ERC-8004 spec: clientAddresses MUST be provided (non-empty) to mitigate Sybil/spam attacks.
 */
export const GetReputationSummarySchema = z
  .object({
    agentId: z.string().describe("The agent ID to get reputation summary for"),
    clientAddresses: z
      .array(z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"))
      .min(1, "At least one client address is required to mitigate Sybil/spam attacks")
      .describe(
        "Array of client addresses to filter by. Required per ERC-8004 spec to prevent Sybil attacks.",
      ),
    tag1: z
      .string()
      .optional()
      .default("")
      .describe("Optional primary tag filter (e.g., 'starred', 'uptime', 'responseTime')"),
    tag2: z
      .string()
      .optional()
      .default("")
      .describe("Optional secondary tag filter (e.g., 'day', 'week', 'month')"),
  })
  .strip()
  .describe(
    "Gets aggregated reputation statistics for an agent, filtered by trusted client addresses",
  );

/**
 * Input schema for reading specific feedback.
 */
export const ReadFeedbackSchema = z
  .object({
    agentId: z.string().describe("The agent ID to read feedback for"),
    clientAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
      .describe("The address of the client who gave the feedback"),
    feedbackIndex: z.string().describe("The index of the feedback entry"),
  })
  .strip()
  .describe("Reads a specific feedback entry");

/**
 * Input schema for getting clients who gave feedback.
 */
export const GetClientsSchema = z
  .object({
    agentId: z.string().describe("The agent ID to get clients for"),
  })
  .strip()
  .describe("Gets the list of client addresses who have given feedback to an agent");
