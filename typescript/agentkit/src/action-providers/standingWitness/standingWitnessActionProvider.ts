import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  StandingAuditSchema,
  StandingCircuitBreakerSchema,
  StandingWitnessConfig,
} from "./schemas";
import { DEFAULT_STANDING_WITNESS_URL } from "./constants";
import { verifyRecord } from "./verification";

/** Ordinary signed-record inspection. No ordinary response authorizes execution. */
export class StandingWitnessActionProvider extends ActionProvider {
  readonly baseUrl: string;
  readonly defaultMock: boolean;
  readonly creditToken?: string;
  /**
   * Inspect records without granting execution.
   *
   * @param config - Input for this check.
   */
  constructor(config: StandingWitnessConfig = {}) {
    super("standing_witness", []);
    this.baseUrl = (config.baseUrl ?? DEFAULT_STANDING_WITNESS_URL).replace(/\/+$/, "");
    if (new URL(this.baseUrl).protocol !== "https:") throw new Error("HTTPS service required");
    this.defaultMock = config.defaultMock ?? false;
    this.creditToken = config.creditToken;
  }

  /**
   * Inspect records without granting execution.
   *
   * @param args - Input for this check.
   * @returns The checked result.
   */
  @CreateAction({
    name: "standing_audit",
    description:
      "Inspect the integrity of an ordinary source-attributed signed record. This does not verify current standing or authorize execution.",
    schema: StandingAuditSchema,
  })
  async standingAudit(args: z.infer<typeof StandingAuditSchema>): Promise<string> {
    try {
      const input = {
        subject: args.subject,
        claim: args.claim,
        provenance: {
          source: "agentkit",
          authority: "autonomous-agent",
          evidence: [{ timestamp: new Date().toISOString() }],
        },
      };
      const result = await this.inspect(
        input,
        args.mock ?? this.defaultMock,
        args.paymentSignature || this.creditToken,
      );
      return JSON.stringify({
        status: result.dry_run ? "dry_run_passed" : "record_verified",
        ...result,
      });
    } catch (error) {
      return JSON.stringify({
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Inspect records without granting execution.
   *
   * @param args - Input for this check.
   * @returns The checked result.
   */
  @CreateAction({
    name: "circuit_breaker_gate",
    description:
      "Fail-closed execution gate. Ordinary front-door records do not establish current standing or execution permission; verified records remain BLOCKED. DRY_RUN_PASSED is non-authorizing.",
    schema: StandingCircuitBreakerSchema,
  })
  async circuitBreakerGate(args: z.infer<typeof StandingCircuitBreakerSchema>): Promise<string> {
    try {
      const binding = {
        action: args.proposedAction,
        target: args.targetAddress ?? null,
        valueUsd: args.valueUsd ?? null,
        timestamp: new Date().toISOString(),
      };
      const input = {
        subject: args.targetAddress || "autonomous-agent-action",
        claim: args.proposedAction,
        provenance: {
          source: "agentkit-circuit-breaker",
          authority: "action-gate",
          evidence: [binding],
        },
      };
      const result = await this.inspect(
        input,
        args.mock ?? this.defaultMock,
        args.paymentSignature || this.creditToken,
      );
      return JSON.stringify({
        gate_status: result.dry_run ? "DRY_RUN_PASSED" : "BLOCKED",
        reason: result.dry_run
          ? "Dry-run only; does not authorize execution"
          : "Current standing and execution permission are not establishable under the ordinary front-door interface",
        ...result,
      });
    } catch (error) {
      return JSON.stringify({
        gate_status: "BLOCKED",
        execution_authorized: false,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  supportsNetwork = (_network: Network) => true;
  /**
   * Inspect records without granting execution.
   *
   * @param input - Input for this check.
   * @param isMock - Input for this check.
   * @param token - Input for this check.
   * @returns The checked result.
   */
  private async inspect(
    input: unknown,
    isMock: boolean,
    token?: string,
  ): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (isMock) headers["X-Mock"] = "true";
    if (token) {
      headers["PAYMENT-SIGNATURE"] = token;
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${this.baseUrl}/v1/evaluate`, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (isMock) {
      if (
        (data?.mock !== true && data?.not_a_determination !== true) ||
        data.structurally_complete !== true ||
        !Array.isArray(data.failed) ||
        data.failed.length !== 0 ||
        data.error
      )
        throw new Error("Malformed or failed requested mock response");
      return { dry_run: true, execution_authorized: false };
    }
    if (
      !data ||
      data.mock === true ||
      data.not_a_determination === true ||
      data.type === "WHP-MOCK-DRY-RUN-v1" ||
      data.error
    )
      throw new Error("Unexpected mock/test/error response");
    const discovery = await fetch(`${this.baseUrl}/v1/evaluate`, {
      headers: { Accept: "application/json" },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (discovery.status !== 200) throw new Error("Signing-key discovery unavailable");
    const advertised = await discovery.json();
    if (
      advertised?.signer?.alg !== "Ed25519" ||
      typeof advertised.signer.public_key_b64url !== "string"
    )
      throw new Error("Published signing key unavailable");
    const hash = verifyRecord(data, input, advertised.signer.public_key_b64url);
    return {
      record_integrity_verified: true,
      record_hash: hash,
      current_standing_verified: false,
      execution_authorized: false,
    };
  }
}
export const standingWitnessActionProvider = (config: StandingWitnessConfig = {}) =>
  new StandingWitnessActionProvider(config);
