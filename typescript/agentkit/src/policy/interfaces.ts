export interface ActionContext {
  action: string;
  to?: string;
  amount_usdc?: string;
  aggregate_usdc?: string;
  recipient_count?: number;
  recipient_allocation_hash?: string;
  per_recipient_max?: string;
  transfer_mechanism?: "direct" | "eip3009" | "permit" | "x402";
  creates_recurring_obligation?: boolean;
  creates_commitment?: boolean;
}

export interface PolicyDecision {
  allowed: boolean;
  reason_codes?: string[];
  signal_refs?: Record<string, string>;
  policy_version: string;
  action_context_hash: string;
  decision_ref: string;
  issued_at_ms: number;
  expires_at_ms: number;
  signature?: string;
}

export type PolicyOutcome =
  | "executed"
  | "relay_confirmed"
  | "failed"
  | "denied"
  | "expired"
  | "context_drift"
  | "unauditable_outcome";

export interface PolicyReceipt {
  decision: PolicyDecision;
  outcome: PolicyOutcome;
  tx_hash?: string;
  error?: string;
  issued_at_ms: number;
}

export interface PolicyProvider {
  evaluate(ctx: ActionContext): Promise<PolicyDecision>;
  record?(receipt: PolicyReceipt): Promise<void>;
}
