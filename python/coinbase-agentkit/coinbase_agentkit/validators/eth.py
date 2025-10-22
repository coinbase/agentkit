"""Ethereum-specific validators."""

from web3 import Web3


def validate_eth_address(value: str) -> str:
    """Validate Ethereum address format.

    Args:
        value: The address to validate

    Returns:
        The checksummed address

    Raises:
        ValueError: If the address is invalid

    """
    try:
        return Web3.to_checksum_address(value)
    except ValueError as e:
        raise ValueError("Invalid Ethereum address") from e
