/**
 * Hive Civilization constants for the AgentKit action provider.
 *
 * Treasury and network values are on-chain facts — agents can verify
 * them independently before authorizing payment.
 */

/** Base mainnet chain ID */
export const HIVE_CHAIN_ID = 8453;

/** Hive treasury address on Base mainnet */
export const HIVE_TREASURY_ADDRESS = "0x15184bf50b3d3f52b60434f8942b7d52f2eb436e";

/** Native USDC contract address on Base mainnet */
export const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/** Hive discovery endpoint — free read, no payment required */
export const HIVE_DISCOVERY_URL = "https://hivegate.onrender.com/v1/discovery/agents";

/** Base URL for hivegate */
export const HIVEGATE_BASE_URL = "https://hivegate.onrender.com";

/** Hive MCP Evaluator endpoint */
export const HIVE_EVALUATOR_URL = "https://hive-mcp-evaluator.onrender.com";

/** Brand gold color */
export const HIVE_BRAND_GOLD = "#C08D23";

/** Network identifier for AgentKit */
export const HIVE_NETWORK_ID = "base-mainnet";

/** Default maximum payment in USDC (all Hive services are ≤ $0.05) */
export const HIVE_DEFAULT_MAX_PAYMENT_USDC = 0.10;

/** Hive public GitHub org */
export const HIVE_GITHUB = "https://github.com/srotzin";
