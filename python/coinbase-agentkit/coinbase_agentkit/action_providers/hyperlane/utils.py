"""Utility functions for Hyperlane action provider."""

from decimal import Decimal

from web3 import Web3

from ...wallet_providers import EvmWalletProvider
from ..erc20.constants import ERC20_ABI


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


def address_to_bytes32(address: str) -> bytes:
    """Left-pad a 20-byte EVM address to a 32-byte value for Hyperlane recipients.

    Hyperlane recipients are `bytes32` to allow non-EVM destinations. EVM addresses
    are encoded as 12 zero bytes followed by the 20-byte address.

    Args:
        address: A hex-encoded EVM address.

    Returns:
        bytes: The 32-byte recipient value.

    """
    raw = bytes.fromhex(Web3.to_checksum_address(address)[2:])
    return b"\x00" * 12 + raw
