"""Constants for Morpho action provider."""

METAMORPHO_ABI = [
    {
        "inputs": [
            {"internalType": "uint256", "name": "assets", "type": "uint256"},
            {"internalType": "address", "name": "receiver", "type": "address"},
        ],
        "name": "deposit",
        "outputs": [{"internalType": "uint256", "name": "shares", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "uint256", "name": "assets", "type": "uint256"},
            {"internalType": "address", "name": "receiver", "type": "address"},
            {"internalType": "address", "name": "owner", "type": "address"},
        ],
        "name": "withdraw",
        "outputs": [{"internalType": "uint256", "name": "shares", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]
