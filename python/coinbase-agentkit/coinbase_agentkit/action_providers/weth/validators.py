"""Validators for WETH action inputs."""

from pydantic_core import PydanticCustomError


def eth_amount_validator(value: str) -> str:
    """Validate that amount is a valid ETH value (positive decimal number as string)."""
    try:
        amount = float(value)
        if amount <= 0:
            raise PydanticCustomError(
                "positive_eth",
                "Amount must be greater than 0",
                {"value": value},
            )
    except (ValueError, TypeError) as err:
        raise PydanticCustomError(
            "eth_format",
            "Amount must be a valid decimal number",
            {"value": value},
        ) from err

    return value
