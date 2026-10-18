/**
 * Triqee Action Provider Constants
 */
export const DEFAULT_GATEWAY_URL = "https://silver-dated-treo-brunette.trycloudflare.com";

export const ACTION_NAMES = {
  GET_LEADLAG_DIVERGENCE: "get_leadlag_divergence",
  SIMULATE_FLASHFLOW_ARBITRAGE: "simulate_flashflow_arbitrage",
  GET_B20_INSTITUTIONAL_CARRY: "get_b20_institutional_carry",
} as const;

export const SUPPORTED_PAIRS = [
  "cbBTC/USDC",
  "WETH/USDC",
  "cbETH/WETH",
  "bCOIN-STK/USDC",
  "bTBILL-UST/USDC",
] as const;
