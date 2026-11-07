/**
 * Recta's public API. Every endpoint used here is free, unsigned and needs no API key.
 */
export const RECTA_API_URL = "https://api.recta.build";

/**
 * EVM chains a Recta route can start from, by chain id, with the network name Recta's API uses.
 */
export const RECTA_NETWORK_BY_CHAIN_ID: Readonly<Record<string, string>> = {
  "1": "ethereum",
  "10": "optimism",
  "56": "bnb_chain",
  "130": "unichain",
  "137": "polygon",
  "143": "monad",
  "999": "hyperevm",
  "5042": "arc",
  "8453": "base",
  "42161": "arbitrum",
  "43114": "avalanche",
  "57073": "ink",
  "59144": "linea",
};

/**
 * Routes an agent can declare as the one it would use without Recta.
 */
export const RECTA_BASELINE_PROVIDERS = [
  "across",
  "stargate_v2",
  "usdt0",
  "usdg_oft",
  "debridge_dln",
  "lifi",
] as const;
