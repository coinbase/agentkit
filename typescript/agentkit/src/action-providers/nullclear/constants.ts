/**
 * Default base URL for the hosted NullClear Pre-Execution Firewall & Forensics API.
 */
export const NULLCLEAR_API_BASE_URL = "https://api.nullclear.dev";

/**
 * Supported blockchain networks for NullClear pre-execution token and transaction analysis.
 */
export const NULLCLEAR_FORENSIC_CHAINS = [
  "base",
  "eth",
  "arbitrum",
  "optimism",
  "polygon",
  "bsc",
  "solana",
] as const;

/**
 * Supported EVM chains for proxy slot, ABI, and bytecode CFG inspection.
 */
export const NULLCLEAR_EVM_CHAINS = [
  "base",
  "eth",
  "arbitrum",
  "optimism",
  "polygon",
  "bsc",
] as const;

/**
 * Failure behavior modes for the Drop-In Guarded JSON-RPC proxy.
 */
export const NULLCLEAR_RPC_FAIL_MODES = ["open", "closed"] as const;
