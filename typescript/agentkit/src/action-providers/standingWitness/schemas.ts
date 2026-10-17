import { z } from "zod";

/**
 * Parameters for requesting an epistemic standing audit from Standing Witness.
 */
export const StandingAuditSchema = z
  .object({
    subject: z
      .string()
      .describe("The subject identifier, contract address, agent ID, or statement subject being audited"),
    claim: z
      .string()
      .describe(
        "The specific claim or transaction intent to be verified and evaluated for epistemic standing",
      ),
    
  warrantHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/i)
    .optional()
    .describe("SHA-256 hash of the target contract call parameters A(c) to bind to P(c)"),
  mock: z
      .boolean()
      .optional()
      .describe("Set to true for a free zero-cost structural verification dry-run"),
    paymentSignature: z
      .string()
      .optional()
      .describe("x402 PAYMENT-SIGNATURE or developer credit token for paid determinations"),
  })
  .describe("Parameters for requesting an epistemic standing audit from Standing Witness");

/**
 * Parameters for evaluating whether a proposed action passes the standing circuit breaker gate.
 */
export const StandingCircuitBreakerSchema = z
  .object({
    proposedAction: z
      .string()
      .describe("Description of the proposed autonomous action or tool invocation"),
    targetAddress: z
      .string()
      .optional()
      .describe("Target contract or recipient address for onchain transactions"),
    valueUsd: z
      .number()
      .optional()
      .describe("Estimated USD value or transfer amount involved in the action"),
    
  warrantHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/i)
    .optional()
    .describe("SHA-256 hash of the target contract call parameters A(c) to bind to P(c)"),
  mock: z.boolean().optional().describe("Set to true for dry-run verification"),
    paymentSignature: z
      .string()
      .optional()
      .describe("x402 PAYMENT-SIGNATURE or developer credit token for paid verification"),
  })
  .describe("Parameters for evaluating whether a proposed action passes the standing circuit breaker gate");

/**
 * Configuration options for StandingWitnessActionProvider.
 */
export interface StandingWitnessConfig {
  baseUrl?: string;
  defaultMock?: boolean;
  creditToken?: string;
}
