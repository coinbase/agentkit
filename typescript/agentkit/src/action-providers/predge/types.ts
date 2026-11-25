/**
 * Configuration options for the PredgeActionProvider.
 */
export interface PredgeActionProviderConfig {
  /**
   * Predge API base URL. Defaults to https://api.predge.io
   */
  baseUrl?: string;

  /**
   * Maximum USD amount a paid action may pay per call. Defaults to 0.05.
   * Set to 0 to disable paid actions.
   */
  maxPaymentUsd?: number;

  /**
   * Trusted ed25519 public keys (hex). Defaults to Predge's published attestation key.
   */
  trustedKeys?: string[];
}

/**
 * Signed envelope carried under `attestation` in Predge responses.
 */
export interface PredgeEnvelope {
  [key: string]: unknown;
  canonical: string;
  signature: string;
  public_key: string;
  payload?: unknown;
  kid?: string;
  content_hash?: string;
  envelope_signature?: string;
}

/**
 * Result of verifying a Predge signed record.
 */
export interface PredgeVerification {
  valid: boolean;
  kid?: string;
  checks: {
    trustedKey: boolean;
    signature: boolean;
    payloadMatchesCanonical: boolean | null;
    contentHash: boolean | null;
    envelopeSignature: boolean | null;
  };
  error?: string;
}
