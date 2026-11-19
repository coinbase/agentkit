/**
 * Kestrova public API (Solidity security scanning with Slither, paid per call with x402).
 */
export const KESTROVA_DEFAULT_BASE_URL = "https://kestrova-api.onrender.com";

/**
 * Paid result tiers. Amounts are USDC atomic units (6 decimals).
 */
export const KESTROVA_TIERS = {
  findings: {
    path: "/scan/findings",
    amount: "250000",
    description:
      "every finding with detector, severity, confidence, file/line locations and Slither's description (JSON)",
  },
  full: {
    path: "/scan",
    amount: "1000000",
    description:
      "every finding plus a plain-English explanation and fix for each, with PDF and SARIF report files",
  },
} as const;

export type KestrovaTier = keyof typeof KESTROVA_TIERS;

/**
 * The only payment terms the provider will sign, per AgentKit network ID.
 * Any other network, asset, recipient or amount is refused before a payment is created.
 */
export const KESTROVA_PAYMENT_TERMS: Record<
  string,
  { network: string; asset: string; payTo: string }
> = {
  "base-mainnet": {
    network: "eip155:8453",
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: "0xB40d2B1B0717dA534e4A98463546cA3E58206cA0",
  },
  "solana-mainnet": {
    network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    asset: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    payTo: "CWJdBXpfaARqqWA6XrDXsVGVcZMM8rMcQbSfLqFwNeqc",
  },
};

export const KESTROVA_SOURCE_TAG = "agentkit";
