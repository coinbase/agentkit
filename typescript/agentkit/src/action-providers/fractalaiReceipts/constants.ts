/**
 * Trust roots and fixed protocol constants for the FractalAI receipts action provider.
 *
 * The governance key and the epoch-3 checkpoint were fetched over TLS from
 * https://fractalai.net.co/.well-known/x402-receipt-keys on 2026-10-07 and re-verified locally
 * (root recomputed, ML-DSA-65 signature checked). Pinning them here is trust-on-first-use made
 * explicit and versioned: a directory signed by any other key, an older epoch (rollback) or a
 * different root for epoch 3 (equivocation) is refused.
 */

/** Public key directory of FractalAI receipt keys (spec `FRACTALAI-key-directory-v1`). */
export const FRACTALAI_KEY_DIRECTORY_URL = "https://fractalai.net.co/.well-known/x402-receipt-keys";

/** FractalAI notary endpoint (x402-paid, independent ML-DSA-65 seal of an x402 settlement). */
export const FRACTALAI_NOTARY_URL = "https://fractalai.net.co/api/x402/witness";

/** Pinned FractalAI governance key (ML-DSA-65, base64). kid = 8005759019a101f6. */
export const FRACTALAI_GOVERNANCE_PUBLIC_KEY_B64 = [
  "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",
  "lgyhirmN+iYcuNAWxUE=",
].join("");

/** Pinned directory checkpoint: epochs below it are rollbacks, a different root is equivocation. */
export const FRACTALAI_DIRECTORY_CHECKPOINT = Object.freeze({
  epoch: 3,
  root: "8748d4d6966857adbab6e9f555cc8323f7726c0681b31e9f64df8d989ca088d7",
});

/** Spec identifier and signed-message prefix of the FractalAI key directory. */
export const FRACTALAI_DIRECTORY_SPEC = "FRACTALAI-key-directory-v1";

/** Directory `use` that authorizes FractalAI receipt kinds. */
export const FRACTALAI_RECEIPT_KEY_USE = "x402-receipt";

/** First line of every FractalAI served-receipt message (domain separation). */
export const SERVED_PREFIX = "FRACTALAI-x402-served-v1";

/** Header line of the signed MIDAS alert canonical text. */
export const MIDAS_CANON_HEADER = "FRACTALAI-midas-alert-v1";

/** Fields every MIDAS alert canonical must carry. */
export const MIDAS_REQUIRED_FIELDS = [
  "address",
  "chain_id",
  "health_factor",
  "threshold",
  "collateral_usd",
  "debt_usd",
  "risk_tier",
  "observed_at",
  "source",
  "snapshot_hash",
  "emitted_at",
] as const;

/** Schema label of a FractalAI settlement seal body. */
export const SEAL_SCHEMA = "fractalai.x402-settlement-seal/0.1";

/** Domain of seller self-attested seals: never authorized by the FractalAI directory. */
export const SELF_ATTEST_DOMAIN = "FRACTALAI-x402-self-attest-v1";

/** Route ids reserved for dedicated kinds; they can never be presented as a generic served proof. */
export const RESERVED_ROUTES = ["midas-alert", "x402-witness", "x402-attest-decision"] as const;

/** Allowed route id of a served proof. */
export const ROUTE_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Allowed clock skew for FractalAI signed times (seconds). */
export const FRACTALAI_CLOCK_SKEW_SECONDS = 900;

/** x402 `delivery-receipt` extension: signed-message prefix. */
export const DELIVERY_RECEIPT_DOMAIN = "x402-delivery-receipt/1";

/** x402 `delivery-receipt` extension: key directory spec and signed-message prefix. */
export const DELIVERY_KEY_DIRECTORY_SPEC = "x402-receipt-key-directory/1";

/** x402 `delivery-receipt` extension: required `use` of a receipt key. */
export const DELIVERY_RECEIPT_KEY_USE = "x402-delivery-receipt";

/** x402 `delivery-receipt` extension: conventional key directory path. */
export const DELIVERY_KEY_DIRECTORY_PATH = "/.well-known/x402-receipt-keys";

/** x402 `delivery-receipt` extension: allowed clock skew (seconds). */
export const DELIVERY_CLOCK_SKEW_SECONDS = 300;

/** ML-DSA-65 (FIPS 204) sizes. */
export const ML_DSA_65_PUBLIC_KEY_BYTES = 1952;
export const ML_DSA_65_SIGNATURE_BYTES = 3309;

/** Network, asset and recipient the FractalAI notary charges on (Base mainnet USDC). */
export const NOTARY_NETWORK = "eip155:8453";
export const NOTARY_NETWORK_LEGACY = "base";
export const NOTARY_USDC_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const NOTARY_PAY_TO = "0xC13789e82661635d9Cea38a53A0390CF9939ef4f";

/** Notary price in USDC (whole units). A 402 asking for more than the configured cap is refused. */
export const NOTARY_PRICE_USDC = 0.005;

/** Upper bounds for fetched documents and request time. */
export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
export const FETCH_TIMEOUT_MS = 20_000;
