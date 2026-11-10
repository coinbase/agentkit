/**
 * Public Indexfy MCP server (Streamable HTTP, stateless, JSON responses, no API key).
 * `build_*` tools return unsigned calls for the agent's own wallet; the server never holds keys.
 */
export const INDEXFY_API_URL = "https://api.indexfy.xyz/mcp";

export const BASE_CHAIN_ID = 8453;

/** USDC on Base. */
export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

/** IndexfyZapper on Base: buys or sells an index's whole basket for USDC in one transaction. */
export const INDEXFY_ZAPPER_BASE = "0x44154FC4297823e39553649fea8cC6ce2517d7D4";

/** Index shares are always 18-decimal ERC-20s. */
export const INDEX_SHARE_DECIMALS = 18;

/** A sell this far above the balance (0.000001 shares) is treated as a rounded "all". */
export const SHARE_ROUNDING_DUST = BigInt(10) ** BigInt(12);
