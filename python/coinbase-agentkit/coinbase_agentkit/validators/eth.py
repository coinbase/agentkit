"""Ethereum-specific validators."""

from web3 import Web3

ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"


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


def validate_not_zero_address(value: str) -> str:
    """Validate that an Ethereum address is not the zero address.

    Prevents accidental fund loss by sending to the burn address.
    Security audit fix: @kushmanmb

    Args:
        value: The address to validate

    Returns:
        The checksummed address

    Raises:
        ValueError: If the address is the zero address or invalid

    """
    checksummed = validate_eth_address(value)
    if checksummed.lower() == ZERO_ADDRESS:
        raise ValueError(
            "Cannot use the zero address (0x0000000000000000000000000000000000000000). "
            "Sending to the zero address permanently burns funds."
        )
    return checksummed
