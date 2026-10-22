export const DEVX_TOKEN_CHECK_BASE_URL = "https://tokencheck.madebydevx.com";

/** Payee of the DevX Token Check service. The provider refuses to pay any other address. */
export const DEVX_TOKEN_CHECK_PAY_TO = "0xe30c4544eC57ac44d8586eB49e49e267fc2d40DB";

export const BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const BASE_MAINNET_CAIP2 = "eip155:8453";

/** Default spend cap per check: 0.01 USDC (6 decimals). */
export const DEFAULT_MAX_PRICE_ATOMIC = 10_000n;

export const SUPPORTED_CHAINS = [
  "base",
  "ethereum",
  "arbitrum",
  "optimism",
  "polygon",
  "robinhood",
  "solana",
] as const;

export type TokenCheckChain = (typeof SUPPORTED_CHAINS)[number];

/** AgentKit network ids mapped to Token Check chain names. */
export const NETWORK_ID_TO_CHAIN: Record<string, TokenCheckChain> = {
  "base-mainnet": "base",
  "ethereum-mainnet": "ethereum",
  "arbitrum-mainnet": "arbitrum",
  "optimism-mainnet": "optimism",
  "polygon-mainnet": "polygon",
};

/** Tokens served for free by the demo endpoint (Base only): USDC, WETH, DEGEN, AERO. */
export const DEMO_TOKENS: Record<string, string> = {
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC",
  "0x4200000000000000000000000000000000000006": "WETH",
  "0x4ed4e862860bed51a9570b96d89af5e1b0efefed": "DEGEN",
  "0x940181a94a35a4569e4529a3cdfb74e38fd98631": "AERO",
};
