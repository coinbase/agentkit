/**
 * Configuration for the invinoveritas action provider.
 */
export interface InvinoveritasActionProviderConfig {
  /** Bearer API key for paid /review calls. Free: POST /register {"label":"your-app"}. Falls back to env INVINOVERITAS_API_KEY. */
  apiKey?: string;
  /** Override the API base URL (default https://api.babyblueviper.com). */
  baseUrl?: string;
  /** Per-call timeout in ms (default 20000). Reviews are advisory and must never stall the agent. */
  timeoutMs?: number;
}

export interface PostJsonResult {
  ok: boolean;
  status: number;
  data: unknown;
}

/** Shape of a successful /review response — only the fields this provider reads. */
export interface ReviewApiResponse {
  verdict: string;
  confidence?: number;
  summary?: string;
  issues?: unknown[];
  alternative_approaches?: unknown[];
  onchain_risk?: unknown;
  proof?: unknown;
}
