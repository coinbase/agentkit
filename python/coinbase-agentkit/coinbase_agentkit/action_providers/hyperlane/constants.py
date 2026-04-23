"""Constants for Hyperlane action provider."""

SUPPORTED_NETWORKS = [
    "base-mainnet",
    "ethereum-mainnet",
    "optimism-mainnet",
    "arbitrum-mainnet",
]

# Hyperlane destination domain IDs.
# Source: https://github.com/hyperlane-xyz/hyperlane-registry (per-chain metadata.yaml).
# For most chains the domain ID matches the EVM chain ID by convention.
DESTINATION_DOMAINS = {
    "ethereum": 1,
    "optimism": 10,
    "bsc": 56,
    "gnosis": 100,
    "polygon": 137,
    "base": 8453,
    "arbitrum": 42161,
    "celo": 42220,
    "avalanche": 43114,
    "mantle": 5000,
    "mode": 34443,
    "linea": 59144,
    "scroll": 534352,
    "zora": 7777777,
}

# Hyperlane Warp Route (TokenRouter) ABI - transfer + quote functions.
# Reference: https://github.com/hyperlane-xyz/hyperlane-monorepo
# (solidity/contracts/token/libs/TokenRouter.sol)
WARP_ROUTE_ABI = [
    {
        "inputs": [
            {"internalType": "uint32", "name": "_destination", "type": "uint32"},
            {"internalType": "bytes32", "name": "_recipient", "type": "bytes32"},
            {"internalType": "uint256", "name": "_amountOrId", "type": "uint256"},
        ],
        "name": "transferRemote",
        "outputs": [{"internalType": "bytes32", "name": "messageId", "type": "bytes32"}],
        "stateMutability": "payable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint32", "name": "_destinationDomain", "type": "uint32"},
        ],
        "name": "quoteGasPayment",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]
