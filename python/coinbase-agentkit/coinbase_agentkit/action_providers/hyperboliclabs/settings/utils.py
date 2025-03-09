"""Utility functions for Hyperbolic settings services.

This module provides utility functions for formatting and processing
settings information from Hyperbolic services.
"""

import json
from typing import Any

from .models import WalletLinkResponse


def format_wallet_link_response(response_data: dict[str, Any]) -> str:
    """Format wallet linking response into a readable string.

    Args:
        response_data: API response data from wallet linking.

    Returns:
        str: Formatted response string with next steps.

    """
    # Format the API response
    formatted_response = json.dumps(response_data, indent=2)

    # Add next steps information
    hyperbolic_address = "0xd3cB24E0Ba20865C530831C85Bd6EbC25f6f3B60"
    next_steps = (
        "\nNext Steps:\n"
        "1. Your wallet has been successfully linked to your Hyperbolic account\n"
        "2. To add funds, send any of these tokens on Base network:\n"
        "   - USDC\n"
        "   - USDT\n"
        "   - DAI\n"
        f"3. Send to this Hyperbolic address: {hyperbolic_address}"
    )

    return f"{formatted_response}\n{next_steps}"


__all__ = [
    "format_wallet_link_response",
] 