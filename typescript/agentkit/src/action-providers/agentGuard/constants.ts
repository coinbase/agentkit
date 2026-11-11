/**
 * Known standard contract addresses on Base
 */
export const BASE_USDC_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase();
export const BASE_USDC_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e".toLowerCase();

/**
 * Blocklisted known dangerous function selectors
 */
export const DANGEROUS_SELECTORS: Record<string, string> = {
  "0xf2fde38b": "transferOwnership(address)",
  "0x715018a6": "renounceOwnership()",
  "0x4f1ee3d0": "upgradeToAndCall(address,bytes)",
  "0x3659cfe6": "upgradeTo(address)",
  "0x42966c68": "burn(uint256)",
};

/**
 * Standard default spending and rate limits
 */
export const DEFAULT_MAX_NATIVE_PER_TX = "0.05"; // 0.05 ETH
export const DEFAULT_MAX_NATIVE_DAILY = "0.20"; // 0.20 ETH
export const DEFAULT_MAX_USDC_PER_TX = "50.0"; // 50 USDC
export const DEFAULT_MAX_USDC_DAILY = "200.0"; // 200 USDC
export const DEFAULT_MAX_X402_PER_PAYMENT = "5.0"; // 5 USDC

/**
 * Blocklisted addresses (zero address, burn addresses, known drainers)
 */
export const DEFAULT_BLOCKLISTED_ADDRESSES = [
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
];

/**
 * Heuristic patterns for prompt injection and wallet drain detection
 */
export const PROMPT_INJECTION_PATTERNS = [
  { pattern: /ignore\s+(all\s+)?(previous\s+)?instructions/i, name: "Instruction Override" },
  { pattern: /disregard\s+(the\s+)?(safety|system|guard)/i, name: "Safety Bypass Attempt" },
  {
    pattern: /bypass\s+(the\s+)?(policy|firewall|guardrail|limits)/i,
    name: "Policy Bypass Attempt",
  },
  { pattern: /drain\s+(the\s+)?(wallet|balance|funds|vault)/i, name: "Wallet Drain Command" },
  { pattern: /transfer\s+all\s+(funds|eth|usdc|tokens|balance)/i, name: "Total Transfer Command" },
  {
    pattern: /send\s+(entire|all|whole)\s+(balance|funds|tokens)/i,
    name: "Exhaustive Send Command",
  },
  { pattern: /system:\s*override/i, name: "System Prefix Impersonation" },
  { pattern: /admin\s+mode\s+enabled/i, name: "Fake Admin Escalation" },
];
