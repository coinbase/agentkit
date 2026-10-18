/**
 * Base URL of the Predge API.
 */
export const PREDGE_API_URL = "https://api.predge.io";

/**
 * Predge's published ed25519 attestation key (kid 13fa3d18a369e6c7).
 * Records are verified against this pinned key, never against the key carried inside a record.
 * Key set: https://api.predge.io/.well-known/predge-keys.json
 */
export const PREDGE_ATTESTATION_PUBLIC_KEY =
  "13fa3d18a369e6c71bf941563ba47822b30182273d5106a0e8fb61c5016352d9";

/**
 * Default maximum price, in USD, that a paid Predge action may pay per call.
 */
export const DEFAULT_MAX_PAYMENT_USD = 0.05;

/**
 * USDC assets Predge accepts on networks AgentKit wallets can pay from.
 */
export const PREDGE_USDC_ASSETS: Record<string, string> = {
  "eip155:8453": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
};
