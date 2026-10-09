import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { Network } from "../../network";
import { CreateAction } from "../actionDecorator";
import {
  StandingAuditSchema,
  StandingCircuitBreakerSchema,
  StandingWitnessConfig,
} from "./schemas";
import { WalletProvider } from "../../wallet-providers";
import { DEFAULT_STANDING_WITNESS_URL } from "./constants";

/**
 * Action provider for Standing Witness epistemic verification and circuit breaker checks.
 */
export class StandingWitnessActionProvider extends ActionProvider<WalletProvider> {
  private readonly baseUrl: string;
  private readonly defaultMock: boolean;
  private readonly creditToken?: string;

  /**
   * Creates a new Standing Witness action provider.
   *
   * @param config - Optional configuration for Standing Witness.
   */
  constructor(config: StandingWitnessConfig = {}) {
    super("standing_witness", []);
    this.baseUrl = config.baseUrl ?? DEFAULT_STANDING_WITNESS_URL;
    this.defaultMock = config.defaultMock ?? false;
    this.creditToken = config.creditToken;
  }

  /**
   * Checks if the network is supported.
   *
   * @param _network - The network to check.
   * @returns True if supported.
   */
  supportsNetwork = (_network: Network) => true;

  /**
   * Evaluates epistemic standing for a claim or autonomous agent transaction.
   *
   * @param _walletProvider - The wallet provider.
   * @param args - Input parameters including subject and claim.
   * @returns JSON string representing the standing determination or error.
   */
  @CreateAction({
    name: "standing_audit",
    description: `
    Request an autonomous epistemic standing audit from Standing Witness.
    Verifies claims, statements, or transaction integrity before execution.
    Supports free dry-run via mock=true, or production audits via x402 / credit pack tokens.
    `,
    schema: StandingAuditSchema,
  })
  async standingAudit(
    _walletProvider: WalletProvider,
    args: z.infer<typeof StandingAuditSchema>,
  ): Promise<string> {
    try {
      const url = `${this.baseUrl}/v1/audit`;
      const isMock = args.mock || this.defaultMock;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (isMock) {
        headers["X-Mock"] = "true";
      }

      const token = args.paymentSignature || this.creditToken;
      if (token) {
        headers["PAYMENT-SIGNATURE"] = token;
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          subject: args.subject,
          claim: args.claim,
        }),
      });

      if (res.status === 402) {
        return JSON.stringify({
          status: "payment_required",
          message: "Door requires payment via x402 USDC on Base or developer credit token from /credits. Pass mock=true for dry-run.",
          payment_requirements: await res.json().catch(() => null),
        });
      }

      const data = await res.json();
      return JSON.stringify(data);
    } catch (error) {
      return JSON.stringify({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Evaluates an action through the Standing Witness circuit breaker gate.
   *
   * @param _walletProvider - The wallet provider.
   * @param args - Proposed action parameters.
   * @returns JSON string representing circuit breaker clearance or trip.
   */
  @CreateAction({
    name: "circuit_breaker_gate",
    description: `
    Run an action through the Standing Witness pre-execution circuit breaker.
    Halts execution if epistemic standing is compromised or unverified.
    `,
    schema: StandingCircuitBreakerSchema,
  })
  async circuitBreakerGate(
    _walletProvider: WalletProvider,
    args: z.infer<typeof StandingCircuitBreakerSchema>,
  ): Promise<string> {
    try {
      const isMock = args.mock || this.defaultMock;
      const token = args.paymentSignature || this.creditToken;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (isMock) {
        headers["X-Mock"] = "true";
      }
      if (token) {
        headers["PAYMENT-SIGNATURE"] = token;
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`${this.baseUrl}/v1/evaluate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: args.proposedAction,
          target: args.targetAddress,
          value: args.valueUsd,
        }),
      });

      if (res.status === 402) {
        return JSON.stringify({
          gate_status: "BLOCKED",
          reason: "Payment required (402). Provide payment signature or mock=true.",
        });
      }

      const data = await res.json();
      return JSON.stringify({
        gate_status: "CLEARED",
        evaluation: data,
      });
    } catch (error) {
      return JSON.stringify({
        gate_status: "BLOCKED",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export const standingWitnessActionProvider = (config?: StandingWitnessConfig) =>
  new StandingWitnessActionProvider(config);
