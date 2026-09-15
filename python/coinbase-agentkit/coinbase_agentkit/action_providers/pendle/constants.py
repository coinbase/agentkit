"""Constants for Pendle action provider."""

# Pendle V2 deploys the same canonical router address on every supported chain.
# Source: pendle-finance/pendle-core-v2-public deployments/{chainId}-core.json
PENDLE_ROUTER_ADDRESS = "0x888888888889758F76e7103c6CbF23ABbF58F946"

# Pendle hosted backend + SDK base URL.
# Docs: https://docs.pendle.finance/pendle-v2/Developers/Backend/HostedSdk
PENDLE_API_BASE = "https://api-v2.pendle.finance"

# Origin networks supported as agent wallet networks.
SUPPORTED_NETWORKS = [
    "base-mainnet",
    "ethereum-mainnet",
    "arbitrum-mainnet",
]

# Pendle's hosted SDK is keyed by EVM chain ID, so AgentKit's network IDs
# must be translated to integers when calling the API.
NETWORK_TO_CHAIN_ID = {
    "base-mainnet": 8453,
    "ethereum-mainnet": 1,
    "arbitrum-mainnet": 42161,
}
