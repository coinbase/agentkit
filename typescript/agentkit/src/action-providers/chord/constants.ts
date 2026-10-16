import type { Address } from "viem";

/**
 * Default base URL of the Chord REST API.
 */
export const CHORD_API_BASE_URL = "https://api.getchord.xyz/v1";

/**
 * The Chord router. It is deployed at the same address on every supported chain, and every
 * transaction built by the API must target it.
 */
export const CHORD_ROUTER_ADDRESS: Address = "0x1b1fee89a381e595fe6536b99ba91f3e16e9601a";

/**
 * Address the Chord API uses for a chain's native coin.
 */
export const NATIVE_TOKEN_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

/**
 * Placeholder many tools use for the native coin. Accepted as input and mapped to the zero address.
 */
export const NATIVE_TOKEN_PLACEHOLDER = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

/**
 * USDC system contract on Arc (6 decimals). Arc pays gas in USDC and the Chord API treats the zero
 * address as an alias for this contract, so the provider sends this address instead.
 */
export const ARC_USDC_ADDRESS: Address = "0x3600000000000000000000000000000000000000";

/**
 * Chains the Chord router is live on, keyed by EVM chain id.
 */
export const CHORD_SUPPORTED_CHAINS: Record<number, { name: string; nativeSymbol: string }> = {
  1: { name: "Ethereum", nativeSymbol: "ETH" },
  8453: { name: "Base", nativeSymbol: "ETH" },
  42161: { name: "Arbitrum One", nativeSymbol: "ETH" },
  56: { name: "BNB Chain", nativeSymbol: "BNB" },
  43114: { name: "Avalanche C-Chain", nativeSymbol: "AVAX" },
  143: { name: "Monad", nativeSymbol: "MON" },
  4663: { name: "Robinhood Chain", nativeSymbol: "ETH" },
  5042: { name: "Arc", nativeSymbol: "USDC" },
};

/**
 * Tokens that revert `approve(spender, x > 0)` while the current allowance is not zero, keyed by
 * chain id. For these the provider resets the allowance to zero before approving.
 */
export const APPROVE_RESET_FIRST: Record<number, string[]> = {
  1: ["0xdac17f958d2ee523a2206206994597c13d831ec7"],
};

/**
 * Default slippage tolerance in basis points.
 */
export const DEFAULT_SLIPPAGE_BPS = 50;

/**
 * Price impact (percent) from which the provider adds a warning to its answer.
 */
export const HIGH_PRICE_IMPACT_PCT = 2;
