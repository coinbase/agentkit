/**
 * Configuration options for the InsumerActionProvider.
 */
export interface InsumerActionProviderConfig {
  /**
   * InsumerAPI key (format: insr_live_ followed by 40 hex characters).
   * Falls back to INSUMER_API_KEY environment variable if not provided.
   */
  apiKey?: string;
}

/**
 * Successful response envelope from InsumerAPI
 */
export interface InsumerSuccessResponse<T> {
  ok: true;
  data: T;
  meta: {
    creditsRemaining?: number;
    creditsCharged?: number;
    version: string;
    timestamp: string;
  };
}

/**
 * Error response envelope from InsumerAPI
 */
export interface InsumerErrorResponse {
  ok: false;
  error: {
    code: number;
    message: string;
  };
}

/**
 * Union type for any InsumerAPI response
 */
export type InsumerResponse<T> = InsumerSuccessResponse<T> | InsumerErrorResponse;

/**
 * Attestation result from POST /v1/attest
 */
export interface AttestationData {
  attestation: {
    id: string;
    pass: boolean;
    results: Array<{
      condition: number;
      label?: string;
      type: string;
      chainId?: number | string;
      met: boolean;
      evaluatedCondition?: Record<string, unknown>;
      conditionHash?: string;
      blockNumber?: string;
      blockTimestamp?: string;
      ledgerIndex?: number;
    }>;
    passCount: number;
    failCount: number;
    attestedAt: string;
    expiresAt: string;
  };
  sig: string;
  kid: string;
  jwt?: string;
}

/**
 * Trust profile result from POST /v1/trust
 */
export interface TrustProfileData {
  trust: {
    id: string;
    wallet: string;
    conditionSetVersion: string;
    dimensions: Record<
      string,
      {
        checks: Array<{
          label: string;
          chainId?: number;
          met: boolean;
        }>;
        passCount: number;
        failCount: number;
        total: number;
      }
    >;
    summary: {
      totalChecks: number;
      totalPassed: number;
      totalFailed: number;
      dimensionsWithActivity: number;
      dimensionsChecked: number;
    };
    profiledAt: string;
    expiresAt: string;
  };
  sig: string;
  kid: string;
}

/**
 * Batch trust result from POST /v1/trust/batch
 */
export interface BatchTrustData {
  results: Array<
    | { trust: TrustProfileData["trust"]; sig: string; kid: string }
    | { error: { wallet: string; message: string } }
  >;
  summary: {
    requested: number;
    succeeded: number;
    failed: number;
  };
}

/**
 * Code validation result from GET /v1/codes/{code}
 */
export interface CodeValidationData {
  valid: boolean;
  code: string;
  merchantId?: string;
  discountPercent?: number;
  expiresAt?: string;
  createdAt?: string;
  reason?: string;
}

/**
 * Compliance templates result from GET /v1/compliance/templates
 */
export interface ComplianceTemplatesData {
  templates: Record<
    string,
    {
      provider: string;
      description: string;
      chainId: number;
      chainName: string;
    }
  >;
}
