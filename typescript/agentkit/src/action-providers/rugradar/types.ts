/**
 * Configuration options for the RugRadarActionProvider
 */
export interface RugRadarActionProviderConfig {
  /**
   * Optional RugRadar Pro API key. Without one the free daily limit applies.
   * Falls back to the RUGRADAR_API_KEY environment variable.
   */
  apiKey?: string;
}

/**
 * A single red flag or positive signal from RugRadar
 */
export interface RugRadarFlag {
  sev: string;
  text: string;
}

/**
 * Subset of the RugRadar /api/check response used by this provider
 */
export interface RugRadarTokenResponse {
  ok: boolean;
  error?: string;
  mint?: string;
  name?: string;
  symbol?: string;
  score?: number;
  risk_level?: string;
  summary?: string;
  flags?: RugRadarFlag[];
  report_url?: string;
}

/**
 * Subset of the RugRadar /api/scan-link response used by this provider
 */
export interface RugRadarLinkResponse {
  ok?: boolean;
  error?: string;
  score?: number;
  verdict?: string;
  summary?: string;
  flags?: RugRadarFlag[];
}
