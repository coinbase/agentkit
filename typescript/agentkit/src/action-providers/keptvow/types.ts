/**
 * Configuration options for the KeptvowActionProvider.
 */
export interface KeptvowActionProviderConfig {
  /**
   * Optional Keptvow platform API key (sent as X-Api-Key). Checks work without one; a key
   * is only for platforms on a paid plan. Falls back to the KEPTVOW_API_KEY environment variable.
   */
  apiKey?: string;
}

/**
 * The parts of Keptvow's /v1/check answer this provider uses.
 */
export interface KeptvowCheckResponse {
  verdict?: string;
  advice?: string;
  pay_to?: string;
  sanctions_list?: string | null;
  wallet_page?: string;
  error?: string;
}

/**
 * The parts of Keptvow's /v1/trust/{id} answer this provider uses.
 */
export interface KeptvowTrustResponse {
  agent_id?: string;
  trust_level?: string;
  score?: number;
  reasons?: string[];
  error?: string;
}

/**
 * The parts of Keptvow's /v1/outcomes answer this provider uses.
 */
export interface KeptvowReportResponse {
  status?: string;
  note?: string;
  error?: string;
}
