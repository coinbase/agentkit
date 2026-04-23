"""Utility functions for Pendle action provider."""

from decimal import Decimal
from typing import Any

import requests
from web3 import Web3

from ...network import Network
from ...wallet_providers import EvmWalletProvider
from ..erc20.constants import ERC20_ABI
from .constants import NETWORK_TO_CHAIN_ID, PENDLE_API_BASE


def get_chain_id_for_network(network: Network) -> int:
    """Translate an AgentKit network ID to the EVM chain ID Pendle's API expects.

    Args:
        network: The current wallet network.

    Returns:
        int: The EVM chain ID.

    """
    network_id = network.network_id
    if network_id not in NETWORK_TO_CHAIN_ID:
        raise ValueError(f"Network {network_id} is not supported by Pendle")
    return NETWORK_TO_CHAIN_ID[network_id]


def get_token_decimals(wallet: EvmWalletProvider, token_address: str) -> int:
    """Read the number of decimals for an ERC-20 token.

    Args:
        wallet: The wallet provider for reading from contracts.
        token_address: The address of the ERC-20 token.

    Returns:
        int: The number of decimals.

    """
    return wallet.read_contract(
        contract_address=Web3.to_checksum_address(token_address),
        abi=ERC20_ABI,
        function_name="decimals",
        args=[],
    )


def get_token_symbol(wallet: EvmWalletProvider, token_address: str) -> str:
    """Read the symbol for an ERC-20 token.

    Args:
        wallet: The wallet provider for reading from contracts.
        token_address: The address of the ERC-20 token.

    Returns:
        str: The token symbol.

    """
    return wallet.read_contract(
        contract_address=Web3.to_checksum_address(token_address),
        abi=ERC20_ABI,
        function_name="symbol",
        args=[],
    )


def get_token_balance(wallet: EvmWalletProvider, token_address: str) -> int:
    """Read the wallet's balance of an ERC-20 token in atomic units.

    Args:
        wallet: The wallet provider for reading from contracts.
        token_address: The address of the ERC-20 token.

    Returns:
        int: The balance in atomic units.

    """
    return wallet.read_contract(
        contract_address=Web3.to_checksum_address(token_address),
        abi=ERC20_ABI,
        function_name="balanceOf",
        args=[wallet.get_address()],
    )


def format_amount_with_decimals(amount: str, decimals: int) -> int:
    """Convert a human-readable token amount to atomic units.

    Args:
        amount: The amount as a string (e.g. "0.1").
        decimals: The number of decimals for the token.

    Returns:
        int: The amount in atomic units.

    """
    try:
        if "e" in amount.lower():
            return int(Decimal(amount) * (10**decimals))

        parts = amount.split(".")
        if len(parts) == 1:
            return int(parts[0]) * (10**decimals)

        whole, fraction = parts
        if len(fraction) > decimals:
            fraction = fraction[:decimals]
        else:
            fraction = fraction.ljust(decimals, "0")

        return int(whole) * (10**decimals) + int(fraction)
    except ValueError as e:
        raise ValueError(f"Invalid amount format: {amount}") from e


def format_amount_from_decimals(amount: int, decimals: int) -> str:
    """Convert an atomic token amount to a human-readable string.

    Args:
        amount: The amount in atomic units.
        decimals: The number of decimals for the token.

    Returns:
        str: The amount as a human-readable string.

    """
    if amount == 0:
        return "0"

    s = str(Decimal(amount) / (10**decimals))
    return s.rstrip("0").rstrip(".") if "." in s else s


def approve_token(
    wallet: EvmWalletProvider, token_address: str, spender_address: str, amount: int
) -> str:
    """Approve a spender to transfer the given token amount on behalf of the wallet.

    Args:
        wallet: The wallet provider for sending transactions.
        token_address: The ERC-20 token address.
        spender_address: The address authorized to spend.
        amount: The amount to approve in atomic units.

    Returns:
        str: The approval transaction hash.

    """
    token_contract = Web3().eth.contract(
        address=Web3.to_checksum_address(token_address), abi=ERC20_ABI
    )
    encoded_data = token_contract.encode_abi(
        "approve", args=[Web3.to_checksum_address(spender_address), amount]
    )

    params = {
        "to": Web3.to_checksum_address(token_address),
        "data": encoded_data,
    }

    tx_hash = wallet.send_transaction(params)
    wallet.wait_for_transaction_receipt(tx_hash)
    return tx_hash


def pendle_convert(
    chain_id: int,
    receiver: str,
    slippage: float,
    token_in_address: str,
    amount_in_atomic: int,
    token_out_address: str,
) -> dict[str, Any]:
    """Call Pendle's hosted SDK /convert endpoint to build swap calldata.

    Args:
        chain_id: EVM chain ID (e.g. 8453 for Base).
        receiver: The address that will receive the output tokens.
        slippage: Slippage tolerance as a decimal (e.g. 0.005 for 0.5%).
        token_in_address: The token to spend.
        amount_in_atomic: Amount of token_in in atomic units.
        token_out_address: The token to receive.

    Returns:
        dict: The Pendle SDK response containing the prepared transaction.

    """
    url = f"{PENDLE_API_BASE}/core/v3/sdk/{chain_id}/convert"
    body = {
        "receiver": Web3.to_checksum_address(receiver),
        "slippage": slippage,
        "inputs": [
            {
                "token": Web3.to_checksum_address(token_in_address),
                "amount": str(amount_in_atomic),
            }
        ],
        "outputs": [
            {"token": Web3.to_checksum_address(token_out_address)},
        ],
        "enableAggregator": True,
    }

    response = requests.post(url, json=body, timeout=20)
    response.raise_for_status()
    return response.json()


def pendle_get_market(chain_id: int, market_address: str) -> dict[str, Any]:
    """Fetch a single market's metadata from Pendle's backend.

    Args:
        chain_id: EVM chain ID.
        market_address: The market address.

    Returns:
        dict: The market metadata payload from Pendle.

    """
    url = f"{PENDLE_API_BASE}/core/v1/{chain_id}/markets/{Web3.to_checksum_address(market_address)}"
    response = requests.get(url, timeout=20)
    response.raise_for_status()
    return response.json()
