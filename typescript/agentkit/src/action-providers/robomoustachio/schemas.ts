import { z } from "zod";

const NumericAgentIdSchema = z
  .string()
  .regex(/^\d+$/, "agentId must be a numeric string")
  .describe("The ERC-8004 agent ID to inspect (numeric string, for example: '2').");

export interface RobomoustachioActionProviderConfig {
  /**
   * Base URL for the trust oracle API.
   *
   * @default "https://robomoustach.io"
   */
  baseUrl?: string;

  /**
   * Whether API calls should default to demo mode.
   *
   * Demo mode appends `?demo=true` and is designed for no-wallet reads.
   *
   * @default true
   */
  defaultDemo?: boolean;

  /**
   * Request timeout in milliseconds.
   *
   * @default 10000
   */
  requestTimeoutMs?: number;

  /**
   * Default minimum score for `evaluate_agent_risk`.
   *
   * @default 500
   */
  defaultScoreThreshold?: number;
}

export const GetAgentTrustScoreSchema = z
  .object({
    agentId: NumericAgentIdSchema,
    demo: z
      .boolean()
      .optional()
      .describe("Optional override for demo mode. `true` avoids x402 payment requirements."),
  })
  .strip()
  .describe("Inputs for fetching an agent trust score.");

export const GetAgentTrustReportSchema = z
  .object({
    agentId: NumericAgentIdSchema,
    demo: z
      .boolean()
      .optional()
      .describe("Optional override for demo mode. `true` avoids x402 payment requirements."),
  })
  .strip()
  .describe("Inputs for fetching an agent trust report.");

export const EvaluateAgentRiskSchema = z
  .object({
    agentId: NumericAgentIdSchema,
    scoreThreshold: z
      .number()
      .min(0)
      .max(1000)
      .optional()
      .describe("Minimum acceptable score from 0-1000. Defaults to provider config value."),
    demo: z
      .boolean()
      .optional()
      .describe("Optional override for demo mode. `true` avoids x402 payment requirements."),
  })
  .strip()
  .describe("Inputs for pre-flight risk evaluation before transacting with an agent.");

