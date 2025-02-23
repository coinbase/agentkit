"""Constants for ERC20 action provider."""

ERC20_ABI = [
    {
        "type": "function",
        "name": "balanceOf",
        "stateMutability": "view",
        "inputs": [
            {
                "name": "account",
                "type": "address",
            },
        ],
        "outputs": [
            {
                "type": "uint256",
            },
        ],
    },
    {
        "type": "function",
        "name": "transfer",
        "stateMutability": "nonpayable",
        "inputs": [
            {
                "name": "recipient",
                "type": "address",
            },
            {
                "name": "amount",
                "type": "uint256",
            },
        ],
        "outputs": [
            {
                "type": "bool",
            },
        ],
    },
]
