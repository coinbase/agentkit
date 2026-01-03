/**
 * Known facilitator registry
 */
export const KNOWN_FACILITATORS = {
  cdp: "https://api.cdp.coinbase.com/platform/v2/x402",
  payai: "https://facilitator.payai.network",
} as const;

export type KnownFacilitatorName = keyof typeof KNOWN_FACILITATORS;

export const DEFAULT_FACILITATOR: KnownFacilitatorName = "cdp";

/**
 * Supported networks for x402 payment protocol
 */
export const SUPPORTED_NETWORKS = [
  "base-mainnet",
  "base-sepolia",
  "solana-mainnet",
  "solana-devnet",
] as const;

/**
 * USDC token addresses for Solana networks
 */
export const SOLANA_USDC_ADDRESSES = {
  "solana-devnet": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  "solana-mainnet": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
} as const;

/**
 * Network mapping from internal network ID to both v1 and v2 (CAIP-2) formats.
 * Used for filtering discovery results that may contain either format.
 */
export const NETWORK_MAPPINGS: Record<string, string[]> = {
  "base-mainnet": ["base", "eip155:8453"],
  "base-sepolia": ["base-sepolia", "eip155:84532"],
  "solana-mainnet": ["solana", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"],
  "solana-devnet": ["solana-devnet", "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"],
};

/**
 * x402 protocol version type
 */
export type X402Version = 1 | 2;

/**
 * Payment option from discovery API (supports both v1 and v2 formats)
 */
export interface PaymentOption {
  scheme: string;
  network: string;
  asset: string;
  // v1 format
  maxAmountRequired?: string;
  // v2 format
  amount?: string;
  price?: string;
  payTo?: string;
  description?: string;
}

/**
 * Resource from discovery API
 */
export interface DiscoveryResource {
  url?: string;
  resource?: string;
  type?: string;
  metadata?: {
    [key: string]: unknown;
    description?: string;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
  };
  accepts?: PaymentOption[];
  x402Version?: number;
  lastUpdated?: string;
}

/**
 * Simplified resource output for LLM consumption
 */
export interface SimplifiedResource {
  url: string;
  price: string;
  description: string;
}
