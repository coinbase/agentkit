/**
 * The Graph's live x402 gateway. Subgraph queries settle in USDC on Base per call.
 */
export const GRAPH_X402_GATEWAY_BASE = "https://gateway.thegraph.com/api/x402";

/**
 * The Graph Network metadata subgraph (indexes every subgraph, version and
 * deployment). Used for keyword discovery + popularity ranking.
 */
export const GRAPH_NETWORK_SUBGRAPH_ID = "DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp";

/**
 * USDC on Base (the asset x402 payments settle in).
 */
export const GRAPH_USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/**
 * Payments settle on Base, so the provider only supports Base mainnet.
 */
export const THE_GRAPH_SUPPORTED_NETWORKS = ["base-mainnet"];

/**
 * Per-query spend ceiling in whole USDC. A query whose 402 price exceeds this is
 * refused before any payment is signed. Typical gateway price is ~$0.01.
 * Overridable via config or the THE_GRAPH_MAX_PAYMENT_USDC env var.
 */
export const DEFAULT_MAX_PAYMENT_USDC = 1.0;
