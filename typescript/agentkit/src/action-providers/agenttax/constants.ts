/**
 * AgentTax Base Builder Code (ERC-8021).
 *
 * Registered at https://dashboard.base.org. Appended to the calldata of every
 * onchain transaction this provider executes so that AgentTax-attributed
 * activity is discoverable in the Base developer dashboard and eligible
 * for any Base ecosystem rewards program.
 *
 * Format: `[ascii builder code][length byte = 0x0b][ERC-8021 magic 0x8021 pattern]`
 * Gas overhead: ~450 gas per transaction (16 gas per non-zero byte).
 */
export const AGENTTAX_BUILDER_CODE = "bc_626v2pr2";
export const AGENTTAX_BUILDER_CODE_SUFFIX =
  "0x62635f36323676327072320b0080218021802180218021802180218021" as `0x${string}`;

/**
 * Default AgentTax API base URL.
 */
export const DEFAULT_BASE_URL = "https://agenttax.io";

/**
 * Default HTTP request timeout in milliseconds.
 * AgentTax API is designed to respond within a few hundred ms; a 10s ceiling
 * is generous enough to cover cold starts and temporary network hiccups
 * without hanging an agent run.
 */
export const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Canonical USDC token addresses on supported Base networks.
 * Used by {@link remitTaxOnchain} when constructing the transfer calldata.
 *
 * Base mainnet USDC: https://basescan.org/token/0x833589fcd6edb6e08f4c7c32d4f71b54bda02913
 * Base sepolia USDC: https://sepolia.basescan.org/token/0x036cbd53842c5426634e7929541ec2318f3dcf7e
 */
export const USDC_ADDRESSES: Record<string, `0x${string}`> = {
  "base-mainnet": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

/**
 * USDC has 6 decimals on all supported networks.
 */
export const USDC_DECIMALS = 6;

/**
 * Networks where the onchain `remit_tax_onchain` action is supported.
 * HTTP-only actions are network-agnostic — they work anywhere the agent runs.
 */
export const SUPPORTED_ONCHAIN_NETWORKS = ["base-mainnet", "base-sepolia"] as const;

export type SupportedOnchainNetwork = (typeof SUPPORTED_ONCHAIN_NETWORKS)[number];
