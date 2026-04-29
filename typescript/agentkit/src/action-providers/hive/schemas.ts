import { z } from "zod";

/**
 * Configuration options for HiveActionProvider.
 */
export interface HiveConfig {
  /**
   * Maximum payment per request in USDC whole units.
   * Default: 0.10 (10 cents). All Hive services are ≤ $0.05.
   */
  maxPaymentUsdc?: number;
}

/**
 * Schema for hive_discover_services — no parameters required.
 */
export const DiscoverServicesSchema = z
  .object({})
  .describe("No parameters required. Fetches the live Hive service catalog from hivegate.");

/**
 * Schema for hive_call_service — generic x402-paid call wrapper.
 */
export const CallServiceSchema = z
  .object({
    serviceUrl: z
      .string()
      .url()
      .describe(
        "The full URL of the Hive service endpoint to call (e.g. https://hive-mcp-evaluator.onrender.com/mcp).",
      ),
    toolName: z
      .string()
      .describe(
        "The MCP tool name to invoke on the service (e.g. 'submit_job', 'analyze_image').",
      ),
    toolArgs: z
      .record(z.string(), z.unknown())
      .nullable()
      .describe(
        "Arguments to pass to the tool as a JSON object. Pass null if the tool takes no arguments.",
      ),
    method: z
      .enum(["GET", "POST", "PUT", "PATCH"])
      .nullable()
      .transform(val => val ?? "POST")
      .describe("HTTP method. Defaults to POST for MCP tool calls."),
  })
  .describe(
    "Calls a Hive x402-protected service. Handles the 402 challenge/payment/retry cycle automatically.",
  );

/**
 * Schema for hive_get_treasury_info — returns static Hive treasury and network constants.
 */
export const GetTreasuryInfoSchema = z
  .object({})
  .describe(
    "Returns Hive treasury address, network (Base mainnet 8453), USDC contract, and brand info. Useful for verifying payment destinations before calling a service.",
  );

/**
 * Schema for hive_evaluator_submit_job — concrete example for hive-mcp-evaluator.
 */
export const EvaluatorSubmitJobSchema = z
  .object({
    jobPayload: z
      .record(z.string(), z.unknown())
      .describe(
        "The job payload to submit. Example: { model: 'gpt-4o', prompt: 'Evaluate this text…', text: 'Hello world' }",
      ),
  })
  .describe(
    "Submits a job to the Hive MCP Evaluator service ($0.01 USDC). This is a concrete example action — copy the pattern for other Hive tools.",
  );
