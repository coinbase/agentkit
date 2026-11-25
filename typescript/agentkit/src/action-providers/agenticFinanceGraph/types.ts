/**
 * Configuration for the Agentic Finance Graph action provider.
 */
export interface AgenticFinanceGraphActionProviderConfig {
  /**
   * Base URL of the API. Defaults to https://agenticfinancegraph.com.
   */
  baseUrl?: string;

  /**
   * Optional API key or Desk session token for the full data tier. Every action works on the
   * free tier without a key. Defaults to the AGENTIC_FINANCE_GRAPH_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * Request timeout in milliseconds. Defaults to 15000.
   */
  timeoutMs?: number;
}

/**
 * Payment totals of one ranked agent, as returned by the API.
 */
export interface AgentPayments {
  events: number;
  usd: number;
  counterparties: number;
  events_30d: number;
  usd_30d: number;
  first: string | null;
  last: string | null;
}

/**
 * One ranked agent, as returned by GET /api/agents?q=.
 */
export interface AgentSummary {
  id: string;
  token_id: string;
  slug: string;
  url: string;
  liveness: number;
  registered_at: string | null;
  chain: string;
  wallet: string | null;
  usdc_float: number | null;
  stables_float: number | null;
  delegated_7702: string | null;
  pay: AgentPayments;
  open_incidents: number;
  bind_method_label: string | null;
  binding_confidence: string | null;
  bind_evidence: string | null;
}

/**
 * Response of GET /api/agents?q=.
 */
export interface AgentLookupResponse {
  as_of: string;
  ranked: boolean;
  note: string | null;
  agent: AgentSummary | null;
}

/**
 * One detection, as returned by GET /api/detections.
 */
export interface Detection {
  kind: string;
  severity: string;
  at: string;
  live: boolean;
  headline?: string;
}

/**
 * Response of GET /api/detections.
 */
export interface DetectionsResponse {
  as_of: string;
  detections: Detection[];
}

/**
 * The canonical body of an agent statement. Amounts are USDC base units (6 decimals).
 */
export interface StatementBody {
  agentId: string;
  chainId: string;
  wallet: string;
  windowStart: string;
  windowEnd: string;
  outCount?: string;
  outSum?: string;
  spendSum?: string;
  routeSum?: string;
  uncheckedSum?: string;
  leftControl?: string;
  inCount?: string;
  inSum?: string;
  flags: string[];
  prevHash: string;
}

/**
 * Response of GET /api/statement/{id}.
 */
export interface StatementResponse {
  token_id: string;
  slug: string;
  url: string;
  definition: string;
  roots_and_key: string;
  check_before_you_pay: string;
  chain_ok: boolean;
  stale: boolean;
  age_hours: number;
  latest: {
    window_start: string;
    window_end: string;
    statement: StatementBody;
    hash: string;
    prev_hash: string;
    leaf: string;
    leaf_index: number;
    proof: string[];
    root: string;
    root_signature: string;
    key_id: string;
    published_at: string;
  };
}

/**
 * Response of GET /api/counterparty?address= (or ?endpoint=).
 */
export interface CounterpartyResponse {
  address: string;
  chain: string;
  resolved_from: string | null;
  as_of: string;
  first_seen: string | null;
  last_seen: string | null;
  n_payments: number;
  distinct_payers: number;
  distinct_l7_payers: number;
  routing_hops_excluded?: { payments: number };
  pre_registration_excluded?: { payments: number };
  receipt_not_read_yet?: { payments: number };
  x402_seller: { resources: number; calls_30d: number } | null;
}

/**
 * One measured figure in GET /api/state.
 */
export interface MeasuredFigure {
  value: number;
  unit: string;
  as_of: string;
  stale: boolean;
  definition_id: string;
}

/**
 * Response of GET /api/state (only the fields this provider reads).
 */
export interface StateResponse {
  as_of: string;
  measured: Record<string, MeasuredFigure | undefined>;
}
