"""Constants for the x402 Bazaar action provider."""

# Base URL for the x402 Bazaar API.
API_BASE_URL = "https://402.com.tr/api/x402"

# token-verdict endpoint + token query param, per token chain. Every chain's
# verdict settles in USDC on Base, so the EVM paid path covers all three.
CHAIN_ENDPOINTS = {
    "base": ("token-verdict", "address"),
    "arbitrum": ("arb-token-verdict", "address"),
    "solana": ("sol-token-verdict", "mint"),
}

# Base token-verdict endpoint (kept for back-compat).
TOKEN_VERDICT_URL = f"{API_BASE_URL}/token-verdict"

# Agent wallet networks this provider activates on. Token screening itself works
# for Base, Arbitrum and Solana tokens via the `chain` input regardless.
SUPPORTED_NETWORKS = ["base-mainnet", "arbitrum-mainnet"]

# USDC on Base — the asset the x402 challenge is priced in.
USDC_BASE_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
