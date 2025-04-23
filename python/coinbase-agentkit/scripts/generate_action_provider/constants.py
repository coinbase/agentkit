"""Constants for the action provider generator script."""

# ascii art banner for AgentKit
AGENTKIT_BANNER = """
 █████   ██████  ███████ ███    ██ ████████    ██   ██ ██ ████████
██   ██ ██       ██      ████   ██    ██       ██  ██  ██    ██
███████ ██   ███ █████   ██ ██  ██    ██       █████   ██    ██
██   ██ ██    ██ ██      ██  ██ ██    ██       ██  ██  ██    ██
██   ██  ██████  ███████ ██   ████    ██       ██   ██ ██    ██
"""

# protocol families with descriptions
PROTOCOL_FAMILIES = [
    {
        "title": "No Protocols",
        "value": "none",
        "description": "No protocol support",
    },
    {
        "title": "All Protocols",
        "value": "all",
        "description": "Support any protocol",
    },
    {
        "title": "EVM Networks",
        "value": "evm",
        "description": "Ethereum Virtual Machine networks (Ethereum, Base, etc.)",
    },
]

# network options organized by protocol family
NETWORKS_BY_PROTOCOL = {
    "all": [
        {
            "title": "All Networks",
            "value": "all",
            "description": "Support any network",
        },
    ],
    "evm": [
        {
            "title": "All EVM Networks",
            "value": "all",
            "description": "Support all EVM networks",
        },
        {
            "title": "Base Mainnet",
            "value": "base-mainnet",
            "description": "Chain ID: 8453",
        },
        {
            "title": "Base Sepolia",
            "value": "base-sepolia",
            "description": "Chain ID: 84532",
        },
        {
            "title": "Ethereum Mainnet",
            "value": "ethereum-mainnet",
            "description": "Chain ID: 1",
        },
        {
            "title": "Ethereum Sepolia",
            "value": "ethereum-sepolia",
            "description": "Chain ID: 11155111",
        },
    ],
}

# base wallet provider configuration
BASE_WALLET_PROVIDERS = {
    "all": [
        {
            "title": "WalletProvider (generic)",
            "value": "WalletProvider",
            "description": "Base wallet provider for general blockchain interactions",
        },
    ],
}

# evm wallet provider configuration
EVM_WALLET_PROVIDERS = [
    {
        "title": "EvmWalletProvider",
        "value": "EvmWalletProvider",
        "description": "For EVM-compatible blockchain networks (Ethereum, Base, etc.)",
    },
    {
        "title": "CdpWalletProvider",
        "value": "CdpWalletProvider",
        "description": "Coinbase Developer Platform wallet provider with built-in key management",
    },
    {
        "title": "EthAccountWalletProvider",
        "value": "EthAccountWalletProvider",
        "description": "Local private key wallet provider for EVM networks",
    },
]

# available wallet providers organized by protocol
WALLET_PROVIDERS_BY_PROTOCOL = {
    **BASE_WALLET_PROVIDERS,
    "evm": EVM_WALLET_PROVIDERS,
}

# success message templates
SUCCESS_MESSAGES = {
    "FILES_CREATED": "\nFiles created:",
    "NEXT_STEPS": "\nNext steps:",
    "REMINDERS": "\nAfter filling in your implementation, do not forget to:",
    "FILE_STRUCTURE": lambda name: {
        "DIR": f"  coinbase_agentkit/action_providers/{name}/",
        "PROVIDER": f"    ├── {name}_action_provider.py",
        "TEST": f"    ├── {name}_action_provider_test.py",
        "SCHEMAS": "    ├── schemas.py",
        "README": "    └── README.md",
    },
    "DESCRIPTIONS": {
        "PROVIDER": "(main provider implementation)",
        "TEST": "(test suite)",
        "SCHEMAS": "(action schemas and types)",
        "README": "(documentation)",
    },
}
