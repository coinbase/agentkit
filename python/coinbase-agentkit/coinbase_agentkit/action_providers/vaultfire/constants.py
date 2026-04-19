"""Vaultfire Protocol contract addresses and ABIs.

All 76 contracts are verified on-chain across Base, Avalanche, Arbitrum, and Polygon.
This file contains ONLY the bond and identity contracts needed by the AgentKit provider.
"""

# ══════════════════════════════════════════════════════════
# CHAIN → NETWORK ID MAPPING
# ══════════════════════════════════════════════════════════

SUPPORTED_NETWORKS: list[str] = [
    "base-mainnet",
    "base-sepolia",
    "arbitrum-mainnet",
    "polygon-mainnet",
    "avalanche-mainnet",
]

CHAIN_IDS: dict[str, int] = {
    "base-mainnet": 8453,
    "base-sepolia": 84532,
    "arbitrum-mainnet": 42161,
    "polygon-mainnet": 137,
    "avalanche-mainnet": 43114,
}

EXPLORER_URLS: dict[str, str] = {
    "base-mainnet": "https://basescan.org",
    "base-sepolia": "https://sepolia.basescan.org",
    "arbitrum-mainnet": "https://arbiscan.io",
    "polygon-mainnet": "https://polygonscan.com",
    "avalanche-mainnet": "https://snowtrace.io",
}


# ══════════════════════════════════════════════════════════
# CONTRACT ADDRESSES
# ══════════════════════════════════════════════════════════

IDENTITY_REGISTRY_ADDRESSES: dict[str, str] = {
    "base-mainnet": "0xa7BD20bf5De63df949cA5Be2F20835978eCba81A",
    "arbitrum-mainnet": "0x83dd216449B3F0574E39043ECFE275946fa492e9",
    "polygon-mainnet": "0xD9bF6D92a1D9ee44a48c38481c046a819CBdf2ba",
    "avalanche-mainnet": "0x7448057C95Fb8a8B974a566cdcc9Cd042166A3f8",
}

PARTNERSHIP_BONDS_ADDRESSES: dict[str, str] = {
    "base-mainnet": "0x01C479F0c039fEC40c0Cf1c5C921bab457d57441",
    "arbitrum-mainnet": "0xdB54B8925664816187646174bdBb6Ac658A55a5F",
    "polygon-mainnet": "0x83dd216449B3F0574E39043ECFE275946fa492e9",
    "avalanche-mainnet": "0xDC8447c66fE9D9c7D54607A98346A15324b7985D",
}

ACCOUNTABILITY_BONDS_ADDRESSES: dict[str, str] = {
    "base-mainnet": "0x6750D28865434344e04e1D0a6044394b726C3dfE",
    "arbitrum-mainnet": "0xef3A944f4d7bb376699C83A29d7Cb42C90D9B6F0",
    "polygon-mainnet": "0xdB54B8925664816187646174bdBb6Ac658A55a5F",
    "avalanche-mainnet": "0x376831fB2457E34559891c32bEb61c442053C066",
}

REPUTATION_REGISTRY_ADDRESSES: dict[str, str] = {
    "base-mainnet": "0x98afd1440B2238D73c1394720277a6d031fCbbD0",
    "arbitrum-mainnet": "0x8B8Ba34F8AAB800F0Ba8391fb1388c6EFb911F92",
    "polygon-mainnet": "0x54e00081978eE2C8d9Ada8e9975B0Bb543D06A55",
    "avalanche-mainnet": "0x5DB1B4b412b80d03819395794fCcF5A73BF30656",
}

VNS_ADDRESSES: dict[str, str] = {
    "base-mainnet": "0xA9e6c2c0a731F1f56F6720Dfac2eB1440Ab9453a",
    "arbitrum-mainnet": "0x7448057C95Fb8a8B974a566cdcc9Cd042166A3f8",
    "polygon-mainnet": "0x7448057C95Fb8a8B974a566cdcc9Cd042166A3f8",
}


# ══════════════════════════════════════════════════════════
# ABIs — Minimal function signatures for on-chain calls
# ══════════════════════════════════════════════════════════

IDENTITY_REGISTRY_ABI: list[dict] = [
    {
        "name": "registerAgent",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "name", "type": "string"},
            {"name": "agentType", "type": "uint8"},
            {"name": "operator", "type": "address"},
        ],
        "outputs": [],
    },
    {
        "name": "getAgentIdentity",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "agent", "type": "address"}],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "components": [
                    {"name": "name", "type": "string"},
                    {"name": "agentType", "type": "uint8"},
                    {"name": "operator", "type": "address"},
                    {"name": "isActive", "type": "bool"},
                    {"name": "registeredAt", "type": "uint256"},
                ],
            }
        ],
    },
    {
        "name": "isRegistered",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "agent", "type": "address"}],
        "outputs": [{"name": "", "type": "bool"}],
    },
    {
        "name": "activeAgentCount",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]

PARTNERSHIP_BONDS_ABI: list[dict] = [
    {
        "name": "createPartnershipBond",
        "type": "function",
        "stateMutability": "payable",
        "inputs": [{"name": "partner", "type": "address"}],
        "outputs": [{"name": "bondId", "type": "uint256"}],
    },
    {
        "name": "getBond",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "bondId", "type": "uint256"}],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "components": [
                    {"name": "creator", "type": "address"},
                    {"name": "partner", "type": "address"},
                    {"name": "stakeAmount", "type": "uint256"},
                    {"name": "createdAt", "type": "uint256"},
                    {"name": "isActive", "type": "bool"},
                    {"name": "lastDistributedValue", "type": "uint256"},
                ],
            }
        ],
    },
    {
        "name": "MIN_VERIFICATION_STAKE",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]

ACCOUNTABILITY_BONDS_ABI: list[dict] = [
    {
        "name": "createAccountabilityBond",
        "type": "function",
        "stateMutability": "payable",
        "inputs": [],
        "outputs": [{"name": "bondId", "type": "uint256"}],
    },
    {
        "name": "getBond",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "bondId", "type": "uint256"}],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "components": [
                    {"name": "creator", "type": "address"},
                    {"name": "stakeAmount", "type": "uint256"},
                    {"name": "createdAt", "type": "uint256"},
                    {"name": "isActive", "type": "bool"},
                    {"name": "lastDistributedValue", "type": "uint256"},
                ],
            }
        ],
    },
    {
        "name": "calculateBondValue",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "bondId", "type": "uint256"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "name": "MIN_VERIFICATION_STAKE",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]

REPUTATION_REGISTRY_ABI: list[dict] = [
    {
        "name": "getReputation",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "agent", "type": "address"}],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "components": [
                    {"name": "averageRating", "type": "uint256"},
                    {"name": "totalRatings", "type": "uint256"},
                    {"name": "lastUpdated", "type": "uint256"},
                ],
            }
        ],
    },
]

VNS_ABI: list[dict] = [
    {
        "name": "resolveName",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "name", "type": "string"}],
        "outputs": [{"name": "", "type": "address"}],
    },
    {
        "name": "reverseResolve",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "addr", "type": "address"}],
        "outputs": [{"name": "", "type": "string"}],
    },
    {
        "name": "isNameAvailable",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "name", "type": "string"}],
        "outputs": [{"name": "", "type": "bool"}],
    },
    {
        "name": "registerName",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [{"name": "name", "type": "string"}],
        "outputs": [],
    },
]

# ══════════════════════════════════════════════════════════
# AGENT TYPE ENUM MAPPING
# ══════════════════════════════════════════════════════════

AGENT_TYPE_MAP: dict[str, int] = {
    "autonomous": 0,
    "assistant": 1,
    "specialized": 2,
    "multi_agent": 3,
}
