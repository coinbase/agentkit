import { z } from "zod";
import { ActionProvider } from "../actionProvider";
import { CreateAction } from "../actionDecorator";
import { Network } from "../../network";
import {
  EvaluateAgentRiskSchema,
  GetAgentTrustReportSchema,
  GetAgentTrustScoreSchema,
  RobomoustachioActionProviderConfig,
} from "./schemas";

const DEFAULT_BASE_URL = "https://robomoustach.io";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_SCORE_THRESHOLD = 500;

interface ResolvedConfig {
  baseUrl: string;
  defaultDemo: boolean;
  requestTimeoutMs: number;
  defaultScoreThreshold: number;
}

interface RequestResult {
  ok: boolean;
  status: number;
  data: unknown;
  error: string | null;
}

interface ParseBodyResult {
  parsed: boolean;
  data: unknown;
}

type Verdict = "TRUSTED" | "CAUTION" | "RISKY" | "UNKNOWN";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }
    if (value.toLowerCase() === "false") {
      return false;
    }
  }
  return null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(item => typeof item === "string");
}

function classifyScore(score: number | null): { verdict: Verdict; recommendation: string } {
  if (score === null) {
    return {
      verdict: "UNKNOWN",
      recommendation: "Score unavailable. Perform manual review before transacting.",
    };
  }

  if (score >= 700) {
    return {
      verdict: "TRUSTED",
      recommendation: "Strong reputation signal. Safe to proceed with normal safeguards.",
    };
  }

  if (score >= 400) {
    return {
      verdict: "CAUTION",
      recommendation: "Mixed reputation signal. Proceed with limits and additional checks.",
    };
  }

  return {
    verdict: "RISKY",
    recommendation: "Weak reputation signal. Avoid transacting unless independently verified.",
  };
}

/**
 * Action provider for Robomoustachio's ERC-8004 trust oracle.
 */
export class RobomoustachioActionProvider extends ActionProvider {
  private readonly config: ResolvedConfig;

  constructor(config: RobomoustachioActionProviderConfig = {}) {
    super("robomoustachio", []);

    this.config = {
      baseUrl: (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
      defaultDemo: config.defaultDemo ?? true,
      requestTimeoutMs: config.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS,
      defaultScoreThreshold: config.defaultScoreThreshold ?? DEFAULT_SCORE_THRESHOLD,
    };
  }

  @CreateAction({
    name: "get_agent_trust_score",
    description: `Get an agent's trust score from Robomoustachio's ERC-8004 oracle.

Inputs:
- agentId: Numeric ERC-8004 agent ID string
- demo: Optional boolean. If true, request uses demo mode and avoids x402 payments.

Use this before transacting with unknown agents. A higher score means better reputation.`,
    schema: GetAgentTrustScoreSchema,
  })
  async getAgentTrustScore(args: z.infer<typeof GetAgentTrustScoreSchema>): Promise<string> {
    const demo = this.resolveDemoMode(args.demo);
    const result = await this.request(`/score/${args.agentId}`, demo);

    if (!result.ok) {
      return this.failurePayload(args.agentId, result.status, result.error, demo);
    }

    if (!isRecord(result.data)) {
      return this.failurePayload(
        args.agentId,
        result.status,
        "Oracle returned an unexpected response shape.",
        demo,
      );
    }

    const score = readNumber(result.data.score);
    const confidence = readNumber(result.data.confidence);
    const classification = classifyScore(score);

    return JSON.stringify(
      {
        success: true,
        source: "robomoustachio_api",
        mode: demo ? "demo" : "paid",
        agentId: String(result.data.agentId ?? args.agentId),
        score,
        confidence,
        verdict: classification.verdict,
        recommendation: classification.recommendation,
      },
      null,
      2,
    );
  }

  @CreateAction({
    name: "get_agent_trust_report",
    description: `Get a full risk report for an ERC-8004 agent from Robomoustachio.

Inputs:
- agentId: Numeric ERC-8004 agent ID string
- demo: Optional boolean. If true, request uses demo mode and avoids x402 payments.

The report includes score, feedback stats, flags, trend, and risk factors for deeper due diligence.`,
    schema: GetAgentTrustReportSchema,
  })
  async getAgentTrustReport(args: z.infer<typeof GetAgentTrustReportSchema>): Promise<string> {
    const demo = this.resolveDemoMode(args.demo);
    const result = await this.request(`/report/${args.agentId}`, demo);

    if (!result.ok) {
      return this.failurePayload(args.agentId, result.status, result.error, demo);
    }

    if (!isRecord(result.data)) {
      return this.failurePayload(
        args.agentId,
        result.status,
        "Oracle returned an unexpected response shape.",
        demo,
      );
    }

    const score = readNumber(result.data.score);
    const flagged = readBoolean(result.data.flagged);
    const riskFactors = readStringArray(result.data.riskFactors);
    const classification = classifyScore(score);

    return JSON.stringify(
      {
        success: true,
        source: "robomoustachio_api",
        mode: demo ? "demo" : "paid",
        agentId: String(result.data.agentId ?? args.agentId),
        score,
        confidence: readNumber(result.data.confidence),
        totalFeedback: readNumber(result.data.totalFeedback),
        positiveFeedback: readNumber(result.data.positiveFeedback),
        recentTrend: result.data.recentTrend ?? null,
        negativeRateBps: readNumber(result.data.negativeRateBps),
        flagged,
        riskFactors,
        verdict: classification.verdict,
        recommendation: flagged
          ? "Agent is flagged in the trust report. Do not transact without manual override."
          : classification.recommendation,
      },
      null,
      2,
    );
  }

  @CreateAction({
    name: "evaluate_agent_risk",
    description: `Evaluate whether an ERC-8004 agent passes a trust threshold.

Inputs:
- agentId: Numeric ERC-8004 agent ID string
- scoreThreshold: Optional score threshold from 0-1000 (default 500)
- demo: Optional boolean. If true, request uses demo mode and avoids x402 payments.

Returns APPROVED or REJECTED with reasoning. If the oracle is unavailable, this action fails closed and returns REJECTED.`,
    schema: EvaluateAgentRiskSchema,
  })
  async evaluateAgentRisk(args: z.infer<typeof EvaluateAgentRiskSchema>): Promise<string> {
    const demo = this.resolveDemoMode(args.demo);
    const threshold = args.scoreThreshold ?? this.config.defaultScoreThreshold;

    const [scoreResult, reportResult] = await Promise.all([
      this.request(`/score/${args.agentId}`, demo),
      this.request(`/report/${args.agentId}`, demo),
    ]);

    if (!scoreResult.ok || !isRecord(scoreResult.data)) {
      return JSON.stringify(
        {
          success: false,
          source: "robomoustachio_api",
          mode: demo ? "demo" : "paid",
          agentId: args.agentId,
          verdict: "REJECTED",
          threshold,
          reason:
            "Trust oracle unavailable for score retrieval. Defaulting to REJECTED for safety.",
          error: scoreResult.error,
        },
        null,
        2,
      );
    }

    if (!reportResult.ok || !isRecord(reportResult.data)) {
      return JSON.stringify(
        {
          success: false,
          source: "robomoustachio_api",
          mode: demo ? "demo" : "paid",
          agentId: args.agentId,
          verdict: "REJECTED",
          threshold,
          score: readNumber(scoreResult.data.score),
          confidence: readNumber(scoreResult.data.confidence),
          reason:
            "Trust report unavailable. Defaulting to REJECTED for safety until full risk context is available.",
          error: reportResult.error,
        },
        null,
        2,
      );
    }

    const score = readNumber(scoreResult.data.score);
    const reportData = reportResult.data as Record<string, unknown>;
    const flagged = readBoolean(reportData.flagged) === true;
    const riskFactors = readStringArray(reportData.riskFactors);
    const hasRequiredScore = score !== null && score >= threshold;
    const approved = hasRequiredScore && !flagged;

    let reason = approved
      ? `Score ${score} meets threshold ${threshold} and no active report flag is present.`
      : `Score ${score ?? "N/A"} is below threshold ${threshold}.`;

    if (!approved && flagged) {
      reason = `Agent is flagged by trust report${riskFactors.length ? ` (${riskFactors.join(", ")})` : ""}.`;
    }

    return JSON.stringify(
      {
        success: true,
        source: "robomoustachio_api",
        mode: demo ? "demo" : "paid",
        agentId: String(scoreResult.data.agentId ?? args.agentId),
        verdict: approved ? "APPROVED" : "REJECTED",
        threshold,
        score,
        confidence: readNumber(scoreResult.data.confidence),
        flagged,
        riskFactors,
        reason,
      },
      null,
      2,
    );
  }

  supportsNetwork = (network: Network) =>
    network.protocolFamily === "evm" &&
    (network.chainId === "8453" || network.networkId === "base-mainnet");

  private resolveDemoMode(actionDemo?: boolean): boolean {
    return actionDemo ?? this.config.defaultDemo;
  }

  private buildUrl(path: string, demoMode: boolean): string {
    const normalizedPath = path.replace(/^\/+/, "");
    const url = new URL(normalizedPath, `${this.config.baseUrl}/`);
    if (demoMode) {
      url.searchParams.set("demo", "true");
    }
    return url.toString();
  }

  private async request(path: string, demoMode: boolean): Promise<RequestResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    const url = this.buildUrl(path, demoMode);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      const rawText = await response.text();
      const parseResult = this.parseBody(rawText);

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          data: parseResult.data,
          error: this.describeHttpFailure(response.status, parseResult.data, demoMode),
        };
      }

      if (!parseResult.parsed) {
        return {
          ok: false,
          status: response.status,
          data: parseResult.data,
          error: "Oracle returned invalid JSON for a successful response.",
        };
      }

      return {
        ok: true,
        status: response.status,
        data: parseResult.data,
        error: null,
      };
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? `Request timed out after ${this.config.requestTimeoutMs}ms`
          : error instanceof Error
            ? error.message
            : String(error);
      return {
        ok: false,
        status: 0,
        data: null,
        error: `Failed to reach oracle: ${message}`,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseBody(rawText: string): ParseBodyResult {
    if (rawText.trim().length === 0) {
      return { parsed: true, data: {} };
    }
    try {
      return { parsed: true, data: JSON.parse(rawText) };
    } catch {
      return { parsed: false, data: { raw: rawText } };
    }
  }

  private describeHttpFailure(status: number, data: unknown, demoMode: boolean): string {
    if (status === 404) {
      return "Agent was not found in the trust oracle.";
    }

    if (status === 402) {
      if (demoMode) {
        return "Payment required even in demo mode. Verify oracle pricing configuration.";
      }
      return "Payment required. Retry with demo=true for free limited output or use x402 payment flow.";
    }

    if (isRecord(data) && typeof data.error === "string") {
      return data.error;
    }

    return `Oracle returned HTTP ${status}.`;
  }

  private failurePayload(agentId: string, status: number, error: string | null, demo: boolean): string {
    return JSON.stringify(
      {
        success: false,
        source: "robomoustachio_api",
        mode: demo ? "demo" : "paid",
        agentId,
        verdict: "UNKNOWN",
        recommendation: "Could not verify trust score. Perform manual review before transacting.",
        status,
        error: error ?? "Unknown oracle error",
      },
      null,
      2,
    );
  }
}

export const robomoustachioActionProvider = (config?: RobomoustachioActionProviderConfig) =>
  new RobomoustachioActionProvider(config);
