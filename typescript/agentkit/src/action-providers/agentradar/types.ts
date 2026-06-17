/**
 * Per-signal trust scores returned by AgentRadar (each 0-100).
 */
export interface AgentRadarSignals {
  identity?: number;
  fidelity?: number;
  health?: number;
  reputation?: number;
  scamDetection?: number;
  external?: number;
}

/**
 * A risk flag attached to an AgentRadar verification result.
 */
export interface AgentRadarRiskFlag {
  severity: string;
  message: string;
}

/**
 * Response shape from the AgentRadar `/verify` endpoint.
 */
export interface AgentRadarVerifyResponse {
  address: string;
  caip10?: string;
  score: number;
  verdict: string;
  signals?: AgentRadarSignals;
  riskFlags?: AgentRadarRiskFlag[];
}
