"""Constants for the Prism Network action provider."""

import re

from web3 import Web3

ROBINHOOD_RPC = "https://rpc.mainnet.chain.robinhood.com"
CHAIN_ID = 4663
USDG_ADDRESS = Web3.to_checksum_address("0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168")
DEFAULT_ESCROW = Web3.to_checksum_address("0x71Df0eF3bc81022cB3bec0b1a05f52f12bAfcDeD")
USDG_DECIMALS = 6
CONFIRMATIONS = 12
FETCH_TIMEOUT = 30
DEFAULT_API_BASE = "https://prismnetwork.tech"

# A digest-pinned default image so the boot target can't silently drift.
DEFAULT_IMAGE = (
    "docker.io/ollama/ollama@sha256:"
    "a61a8fd395dbb931cc8cb1b5da7a2510746575c87113fdc45b647ee59ef7f808"
)

DIGEST_PATTERN = re.compile(r"@sha256:[0-9a-f]{64}$")

ERC20_ABI = [
    {
        "name": "approve",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "value", "type": "uint256"},
        ],
        "outputs": [{"type": "bool"}],
    },
    {
        "name": "allowance",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "spender", "type": "address"},
        ],
        "outputs": [{"type": "uint256"}],
    },
    {
        "name": "balanceOf",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "owner", "type": "address"}],
        "outputs": [{"type": "uint256"}],
    },
]

ESCROW_ABI = [
    {
        "name": "createLease",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "nodeId", "type": "bytes32"},
            {"name": "duration", "type": "uint32"},
            {"name": "clientReference", "type": "bytes32"},
        ],
        "outputs": [{"type": "uint256"}],
    },
]
