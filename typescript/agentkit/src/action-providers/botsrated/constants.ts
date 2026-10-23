export const BOTSRATED_BASE_URL = "https://botsrated.com";

/** BotsRated's payTo on Base. Paid checks to any other address are refused. */
export const BOTSRATED_PAY_TO = "0x7F936f42F46B6c4Cbd3242cF8A1759dfe829E349";

export const BASE_MAINNET_CAIP2 = "eip155:8453";
export const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/** Published price of `GET /v1/check` ($0.001), in atomic USDC (6 decimals). */
export const CHECK_PRICE_ATOMIC = 1000n;

/** Free `GET /v1/check` calls per client per UTC day; inside it BotsRated answers 200 with `charged: false`. */
export const FREE_CHECKS_PER_DAY = 100;

export const REQUEST_TIMEOUT_MS = 8000;
