import {
  NULLCLEAR_EVM_CHAINS,
  NULLCLEAR_FORENSIC_CHAINS,
  NULLCLEAR_RPC_FAIL_MODES,
} from "./constants";

/**
 * Supported blockchain identifiers for NullClear forensics and transaction simulation.
 */
export type NullClearForensicChain = (typeof NULLCLEAR_FORENSIC_CHAINS)[number];

/**
 * Supported EVM blockchain identifiers for NullClear contract inspection.
 */
export type NullClearEvmChain = (typeof NULLCLEAR_EVM_CHAINS)[number];

/**
 * Guarded JSON-RPC failure handling mode when preflight simulation times out.
 */
export type NullClearRpcFailMode = (typeof NULLCLEAR_RPC_FAIL_MODES)[number];

/**
 * Configuration options for {@link NullClearActionProvider}.
 */
export interface NullClearActionProviderConfig {
  /** Base URL for the NullClear API (defaults to `https://api.nullclear.dev`). */
  apiBaseUrl?: string;

  /**
   * Optional Prepaid Pass API key (`nc_live_...`) for high-throughput Bearer authentication.
   * When omitted, requests automatically use NullClear's zero-key daily free tier (10 calls/day/IP).
   */
  apiKey?: string;
}

/**
 * Options for constructing a Drop-In Guarded JSON-RPC endpoint URL.
 */
export interface NullClearGuardedRpcOptions {
  /** Target chain for the Guarded JSON-RPC proxy. */
  chain: NullClearForensicChain;

  /** Prepaid Pass API key (`nc_live_...`). */
  apiKey: string;

  /** Optional custom NullClear API base URL (defaults to `https://api.nullclear.dev`). */
  apiBaseUrl?: string;

  /** Failure policy when simulation times out: `"open"` (default) or `"closed"`. */
  failMode?: NullClearRpcFailMode;

  /** Simulation budget timeout in milliseconds (e.g. `800`). */
  timeoutMs?: number;

  /** When true, also block transactions flagged as `CAUTION_HIGH_RISK`. */
  blockCaution?: boolean;
}
