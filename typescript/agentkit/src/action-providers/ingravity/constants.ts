/**
 * @file constants.ts
 * @description Core constants, endpoints, contracts, and builder codes for Ingravity Security Action Provider.
 */

export const INGRAVITY_WORKER_URL = "https://red-shape-1b3b.daviddelmoral79.workers.dev";
export const INGRAVITY_PAY_TO_WALLET = "0xAA99e12320a3db0116ef56D2e19F70f6796Bad0f";
export const BASE_USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const BASE_CHAIN_ID = 8453;

/**
 * ERC-8021 Builder Attribution Code & Calldata Suffix for Base Mainnet.
 */
export const ERC8021_BUILDER_CODE = "bc_i26d7owr";
export const ERC8021_SUFFIX_HEX = "0b62635f69323664376f77720080218021802180218021802180218021";

/**
 * Supported EVM Chain IDs
 */
export const SUPPORTED_CHAIN_IDS = [
  8453,  // Base
  42161, // Arbitrum One
  10,    // OP Mainnet (Optimism)
  137,   // Polygon
  1,     // Ethereum Mainnet
] as const;

/**
 * Pricing Catalog in Native Base USDC (x402 v2 protocol)
 */
export const INGRAVITY_PRICES_USDC = {
  FAST_PING: "0.01",
  TX_FIREWALL: "0.10",
  TOKEN_RUG_FULL: "0.12",
  TOKEN_RUG_ESSENTIAL: "0.04",
  DEFI_MATH_FULL: "0.10",
  DEFI_MATH_ESSENTIAL: "0.04",
  AUDIT_SOLIDITY_FULL: "0.85",
  AUDIT_SOLIDITY_ESSENTIAL: "0.35",
  PROTOCOL_DOSSIER_FULL: "12.00",
  PROTOCOL_DOSSIER_ESSENTIAL: "3.50",
  DEEP_EXPLOIT_FULL: "45.00",
  DEEP_EXPLOIT_ESSENTIAL: "9.50",
} as const;

export const INGRAVITY_ACTION_PROVIDER_NAME = "ingravity_security";
export const INGRAVITY_SDK_VERSION = "1.3.0";
