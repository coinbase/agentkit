export const INGRAVITY_WORKER_URL = "https://red-shape-1b3b.daviddelmoral79.workers.dev";
export const INGRAVITY_PAY_TO_WALLET = "0xAA99e12320a3db0116ef56D2e19F70f6796Bad0f";
export const BASE_USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const BASE_CHAIN_ID = 8453;
export const BASE_CAIP2_NETWORK = "eip155:8453";
export const USDC_DECIMALS = 6;

export const ERC8021_BUILDER_CODE = "bc_i26d7owr";
export const ERC8021_SUFFIX_HEX = "0b62635f69323664376f77720080218021802180218021802180218021";

export const SUPPORTED_CHAIN_IDS = [8453, 42161, 10, 137, 1] as const;

export const INGRAVITY_ROUTES = {
  FAST_PING: "/api/v1/fast-ping",
  TX_FIREWALL: "/api/v1/tx-firewall",
  TOKEN_RUG_SCANNER: "/api/v1/token-rug-scanner",
  DEFI_MATH_GUARD: "/api/v1/defi-math-guard",
  AUDIT_SOLIDITY: "/api/v1/audit-solidity",
  PROTOCOL_DOSSIER: "/api/v1/protocol-dossier",
  DEEP_EXPLOIT_BOUNTY: "/api/v1/deep-exploit-bounty",
} as const;

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
