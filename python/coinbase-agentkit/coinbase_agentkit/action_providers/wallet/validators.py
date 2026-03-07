"""Validators for Wallet action provider schemas."""

import re
from decimal import Decimal

from pydantic_core import PydanticCustomError

# The EVM zero address. Sending tokens here burns them permanently with no recovery.
_EVM_ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"


def positive_decimal_validator(value: str) -> str:
    """Validate positive decimal number format."""
    pattern = r"^[0-9]*\.?[0-9]+$"
    if not re.match(pattern, value):
        raise PydanticCustomError(
            "decimal_format",
            "Invalid decimal format. Must be a positive number.",
            {"pattern": pattern},
        )

    try:
        decimal_value = Decimal(value)
        if decimal_value <= 0:
            raise PydanticCustomError(
                "positive_decimal",
                "Value must be greater than 0",
                {"value": value},
            )
    except (ValueError, TypeError, ArithmeticError) as e:
        raise PydanticCustomError(
            "decimal_parse",
            "Failed to parse decimal value",
            {"error": str(e)},
        ) from e

    return value


def zero_address_validator(value: str) -> str:
    """Reject the EVM zero address (0x000...000) as a transfer destination.

    Prevents accidental permanent loss of tokens by sending to the burn address.
    Handles addresses with or without the 0x prefix so that both
    ``0x000...000`` and ``000...000`` (40 hex zeros) are rejected.

    Args:
        value: The destination address to validate.

    Returns:
        The original address string if it is not the zero address.

    Raises:
        PydanticCustomError: If the address is the EVM zero address.

    """
    normalized = value if value.startswith("0x") else f"0x{value}"
    if normalized.lower() == _EVM_ZERO_ADDRESS:
        raise PydanticCustomError(
            "zero_address",
            "Transfer to the zero address is not allowed",
            {"value": value},
        )
    return value
