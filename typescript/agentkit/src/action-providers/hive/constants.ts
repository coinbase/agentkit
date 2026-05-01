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

/** Hive MCP Audit Readiness endpoint — compliance scoring service */
export const HIVE_AUDIT_READINESS_URL = "https://hivemorph.onrender.com/v1/audit/readiness";

/**
 * Hive Audit Readiness tier pricing card.
 * Four tiers, billed annually. Prices are in USD.
 */
export const HIVE_AUDIT_TIER_PRICING = [
  {
    tier: "STARTER",
    price_usd_annual: 500,
    label: "Starter — $500/yr",
    description:
      "Foundational compliance gap analysis for early-stage teams. Covers NIST CSF, SOC 2 Type I, and HIPAA Security Rule basics.",
  },
  {
    tier: "STANDARD",
    price_usd_annual: 1500,
    label: "Standard — $1,500/yr",
    description:
      "Full readiness scoring with remediation roadmap. Adds ISO 27001, SOC 2 Type II, and PCI DSS Level 4 modules.",
  },
  {
    tier: "ENTERPRISE",
    price_usd_annual: 2500,
    label: "Enterprise — $2,500/yr",
    description:
      "Continuous monitoring, evidence-collection automation, and auditor-ready report packages. FedRAMP Moderate and CMMC Level 2 included.",
  },
  {
    tier: "FEDERAL",
    price_usd_annual: 7500,
    label: "Federal — $7,500/yr",
    description:
      "Maximum-coverage tier for federal contractors and regulated financial institutions. FedRAMP High, CMMC Level 3, FISMA, and DISA STIG coverage.",
  },
] as const;
