"""Utility functions for ERC20 action provider."""

from dataclasses import dataclass

from eth_abi import decode
from web3 import Web3

from ...wallet_providers.evm_wallet_provider import EvmWalletProvider
from .constants import ERC20_ABI


@dataclass
class TokenDetails:
    """Details about an ERC20 token."""

    name: str
    decimals: int
    balance: int
    formatted_balance: str


# Multicall3 contract ABI - only the aggregate3 function we need
MULTICALL3_ABI = [
    {
        "inputs": [
            {
                "components": [
                    {"name": "target", "type": "address"},
                    {"name": "allowFailure", "type": "bool"},
                    {"name": "callData", "type": "bytes"},
                ],
                "name": "calls",
                "type": "tuple[]",
            }
        ],
        "name": "aggregate3",
        "outputs": [
            {
                "components": [
                    {"name": "success", "type": "bool"},
                    {"name": "returnData", "type": "bytes"},
                ],
                "name": "returnData",
                "type": "tuple[]",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    }
]

# Multicall3 is deployed at the same address on all chains
MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11"


def get_token_details(
    wallet_provider: EvmWalletProvider,
    contract_address: str,
    address: str | None = None,
) -> TokenDetails | None:
    """Get the details of an ERC20 token including name, decimals, and balance.

    Uses multicall to batch all requests into a single RPC call for efficiency.

    Args:
        wallet_provider (EvmWalletProvider): The wallet provider to use for the call.
        contract_address (str): The contract address of the ERC20 token.
        address (str | None): The address to check the balance for. If not provided, uses the wallet's address.

    Returns:
        TokenDetails | None: Token details or None if there's an error.

    """
    try:
        w3 = Web3()
        check_address = address if address else wallet_provider.get_address()
        checksum_contract = w3.to_checksum_address(contract_address)
        checksum_check = w3.to_checksum_address(check_address)

        # Create the contract instance to encode function calls
        contract = w3.eth.contract(address=checksum_contract, abi=ERC20_ABI)

        # Encode the three function calls
        name_data = contract.encode_abi("name", [])
        decimals_data = contract.encode_abi("decimals", [])
        balance_data = contract.encode_abi("balanceOf", [checksum_check])

        # Prepare multicall calls
        calls = [
            (checksum_contract, True, name_data),
            (checksum_contract, True, decimals_data),
            (checksum_contract, True, balance_data),
        ]

        # Execute multicall
        checksum_multicall = w3.to_checksum_address(MULTICALL3_ADDRESS)
        results = wallet_provider.read_contract(
            contract_address=checksum_multicall,
            abi=MULTICALL3_ABI,
            function_name="aggregate3",
            args=[calls],
        )

        # Decode results
        if not results or len(results) != 3:
            return None

        # Check if all calls succeeded and returned data
        for success, return_data in results:
            if not success or len(return_data) == 0:
                # This is expected for non-ERC20 contracts/EOAs
                return None

        # Decode each result using eth_abi
        name = decode(["string"], results[0][1])[0]
        decimals = decode(["uint8"], results[1][1])[0]
        balance = decode(["uint256"], results[2][1])[0]

        # Format balance
        formatted_balance = str(balance / (10**decimals))

        return TokenDetails(
            name=name,
            decimals=decimals,
            balance=balance,
            formatted_balance=formatted_balance,
        )
    except Exception:
        return None
