"""Validators for Wallet action provider schemas."""

import re
from decimal import Decimal

from pydantic_core import PydanticCustomError


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
