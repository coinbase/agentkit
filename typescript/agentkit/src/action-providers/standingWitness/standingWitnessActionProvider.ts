import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  StandingAuditSchema,
  StandingCircuitBreakerSchema,
  StandingWitnessConfig,
} from "./schemas";
import { DEFAULT_STANDING_WITNESS_URL } from "./constants";

/**
 * StandingWitnessActionProvider provides autonomous agent actions for epistemic standing audits
 * and circuit-breaker gate evaluations through Wheeler Hubbell Publishing Standing Witness.
 */
export class StandingWitnessActionProvider extends ActionProvider {
  readonly baseUrl: string;
  readonly defaultMock: boolean;
  readonly creditToken?: string;

  /**
   * Initializes the StandingWitnessActionProvider.
   *
   * @param config - Configuration options for the provider.
   */
  constructor(config: StandingWitnessConfig = {}) {
    super("standing_witness", []);
    this.baseUrl = (config.baseUrl || DEFAULT_STANDING_WITNESS_URL).replace(/\/+$/, "");
    this.defaultMock = config.defaultMock ?? false;
    this.creditToken = config.creditToken;
  }

  /**
   * Requests an epistemic standing audit for a subject and claim.
   *
   * @param args - The audit parameters.
   * @returns JSON string detailing the audit result, determination, and verification status.
   */
  @CreateAction({
    name: "standing_audit",
    description: `Request an epistemic standing audit from Standing Witness for a subject and claim.
Verifies epistemic authority, provenance constraints, and returns a verified determination.
Supports free structural mock dry-runs (mock: true) or live paid determinations via x402 payment.`,
    schema: StandingAuditSchema,
  })
  async standingAudit(args: typeof StandingAuditSchema._type): Promise<string> {
    const isMock = args.mock ?? this.defaultMock;
    const url = `${this.baseUrl}/v1/evaluate`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "AgentKit-StandingWitness/1.0",
    };

    if (isMock) {
      headers["X-Mock"] = "true";
    }

    const paymentSig = args.paymentSignature || this.creditToken;
    if (paymentSig) {
      headers["PAYMENT-SIGNATURE"] = paymentSig;
      headers["Authorization"] = `Bearer ${paymentSig}`;
    }

    const payload = {
      subject: args.subject,
      claim: args.claim,
      mock: isMock,
      provenance: {
        source: "agentkit",
        authority: "autonomous-agent",
        evidence: `Audit request for ${args.subject}: ${args.claim}`,
        timestamp: new Date().toISOString(),
      },
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (res.status === 402) {
        return JSON.stringify({
          status: "payment_required",
          error: "Audit requires x402 payment (HTTP 402). Provide paymentSignature or set mock: true.",
          url,
        });
      }

      if (!res.ok) {
        const errorText = await res.text();
        return JSON.stringify({
          status: "failed",
          error: `Standing Witness returned HTTP ${res.status}: ${errorText}`,
        });
      }

      const data = await res.json();

      // Check for mock response
      if (data.mock === true || data.not_a_determination === true) {
        if (!isMock) {
          return JSON.stringify({
            status: "failed",
            error: "Unauthenticated mock response returned when live determination was required. Audit failed closed.",
          });
        }

        const structurallyComplete = data.structurally_complete === true;
        const failedChecks = Array.isArray(data.failed) ? data.failed : [];
        if (!structurallyComplete || failedChecks.length > 0) {
          return JSON.stringify({
            status: "failed",
            error: "Mock structural verification failed",
            missing_fields: failedChecks,
          });
        }

        return JSON.stringify({
          status: "dry_run_passed",
          notice: "Mock structural check passed. Note: this is NOT a live signed determination.",
          data,
        });
      }

      return JSON.stringify({
        status: "success",
        determination: data.determination || data.outcome || data,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({
        status: "error",
        error: `Failed to contact Standing Witness: ${message}`,
      });
    }
  }

  /**
   * Evaluates a proposed autonomous action against the Standing Witness circuit-breaker gate.
   *
   * @param args - The circuit breaker parameters.
   * @returns JSON string with gate status ('CLEARED', 'BLOCKED', or 'DRY_RUN_PASSED') and determination details.
   */
  @CreateAction({
    name: "circuit_breaker_gate",
    description: `Evaluate a proposed autonomous transaction or high-consequence action against the Standing Witness circuit-breaker gate.
Fails closed: only allows execution if an authorized determination confirms the action satisfies standing constraints.
Returns gate_status: 'CLEARED' (proceed), 'BLOCKED' (halt execution), or 'DRY_RUN_PASSED' (dry-run only).`,
    schema: StandingCircuitBreakerSchema,
  })
  async circuitBreakerGate(args: typeof StandingCircuitBreakerSchema._type): Promise<string> {
    const isMock = args.mock ?? this.defaultMock;
    const url = `${this.baseUrl}/v1/evaluate`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "AgentKit-StandingWitness/1.0",
    };

    if (isMock) {
      headers["X-Mock"] = "true";
    }

    const paymentSig = args.paymentSignature || this.creditToken;
    if (paymentSig) {
      headers["PAYMENT-SIGNATURE"] = paymentSig;
      headers["Authorization"] = `Bearer ${paymentSig}`;
    }

    const payload = {
      subject: args.targetAddress || "autonomous-agent-action",
      claim: args.proposedAction,
      mock: isMock,
      provenance: {
        source: "agentkit-circuit-breaker",
        authority: "action-gate",
        evidence: JSON.stringify({
          action: args.proposedAction,
          target: args.targetAddress,
          valueUsd: args.valueUsd,
          timestamp: new Date().toISOString(),
        }),
      },
    };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (res.status === 402) {
        return JSON.stringify({
          gate_status: "BLOCKED",
          reason: "Payment required (HTTP 402). Circuit breaker tripped fail-closed.",
          door: url,
        });
      }

      if (!res.ok) {
        return JSON.stringify({
          gate_status: "BLOCKED",
          reason: `Standing Witness returned HTTP ${res.status}. Gate failed closed.`,
        });
      }

      const data = await res.json();

      // Check for mock response
      if (data.mock === true || data.not_a_determination === true) {
        if (!isMock) {
          return JSON.stringify({
            gate_status: "BLOCKED",
            reason: "Unauthenticated mock response returned when live determination was required. Gate failed closed.",
          });
        }

        const structurallyComplete = data.structurally_complete === true;
        const failedChecks = Array.isArray(data.failed) ? data.failed : [];

        if (!structurallyComplete || failedChecks.length > 0) {
          return JSON.stringify({
            gate_status: "BLOCKED",
            reason: `Mock structural check failed: missing required fields [${failedChecks.join(", ")}].`,
          });
        }

        return JSON.stringify({
          gate_status: "DRY_RUN_PASSED",
          notice: "Mock structural verification succeeded. This does NOT authorize real execution.",
          evaluation: data,
        });
      }

      // Check for server error response
      if (data.error) {
        return JSON.stringify({
          gate_status: "BLOCKED",
          reason: `Service error: ${data.error}. Gate failed closed.`,
        });
      }

      // Live determination extraction
      let outcome: string | undefined;
      if (data.determination && typeof data.determination.outcome === "string") {
        outcome = data.determination.outcome;
      } else if (data.record?.determination?.outcome) {
        outcome = data.record.determination.outcome;
      } else if (typeof data.outcome === "string") {
        outcome = data.outcome;
      }

      if (!outcome) {
        return JSON.stringify({
          gate_status: "BLOCKED",
          reason: "Missing determination outcome in response. Gate failed closed.",
          evaluation: data,
        });
      }

      const allowedOutcomes = ["RECOGNIZED WITH BOUNDARIES", "ESTABLISHED", "CLEARED"];
      const isCleared = allowedOutcomes.some(
        allowed => allowed.toUpperCase() === outcome?.toUpperCase(),
      );

      if (!isCleared) {
        return JSON.stringify({
          gate_status: "BLOCKED",
          reason: `Determination outcome '${outcome}' does not satisfy clearing criteria. Gate tripped.`,
          outcome,
          evaluation: data,
        });
      }

      return JSON.stringify({
        gate_status: "CLEARED",
        outcome,
        evaluation: data,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return JSON.stringify({
        gate_status: "BLOCKED",
        reason: `Network/connection error contacting Standing Witness: ${message}. Gate failed closed.`,
      });
    }
  }

  /**
   * Checks if the network is supported.
   *
   * @param _network - The network to check.
   * @returns True if supported.
   */
  supportsNetwork = (_network: Network) => true;
}

export const standingWitnessActionProvider = (config: StandingWitnessConfig = {}) =>
  new StandingWitnessActionProvider(config);
