/**
 * Aerodrome Action Provider Module Index
 *
 * Exports the Aerodrome Action Provider for use with Coinbase AgentKit
 * Features include:
 * - veAERO management (create locks)
 * - Voting for gauges
 * - V2 swapping using stable and volatile pools
 */

export { AerodromeActionProvider, aerodromeActionProvider } from "./aerodromeActionProvider";

// Re-export schemas for consumers who need them
export * from "./schemas";

// Re-export constants for any external code that might need them
export * from "./constants";
