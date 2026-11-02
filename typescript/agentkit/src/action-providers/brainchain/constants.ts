/**
 * Where each supported network pays for BrainChain tasks: the payment desk,
 * the USDC contract and the address the desk takes payment to. Base Sepolia
 * pays the BrainChain testnet desk in test USDC.
 */
export const BRAINCHAIN_NETWORKS = {
  "base-mainnet": {
    desk: "https://brain.usebrainchain.com",
    network: "eip155:8453",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo: "0xafB0C4Ef895D4895040cdC6435B96D3EE8350c6E",
    finalAfter: "about six hours",
  },
  "base-sepolia": {
    desk: "https://brain.testnet.usebrainchain.com",
    network: "eip155:84532",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    payTo: "0xf848984c8A0D9E49Cc9C97380C62b34C6f3b97D1",
    finalAfter: "about an hour",
  },
} as const;

export type BrainChainNetworkId = keyof typeof BRAINCHAIN_NETWORKS;

/** USDC has 6 decimals, so 1 USDC is 1,000,000 base units. */
export const USDC_UNITS = 1_000_000;

/** Longest a result is returned inline; the rest stays at its public link. */
export const RESULT_LIMIT = 20_000;

/** The desk refuses payment authorisations that stay valid longer than this. */
export const MAX_TIMEOUT_SECONDS = 600;
