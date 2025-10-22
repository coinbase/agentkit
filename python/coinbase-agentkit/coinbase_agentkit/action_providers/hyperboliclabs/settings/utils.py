"""Utility functions for Hyperbolic settings services.

This module provides utility functions for formatting and processing
settings information from Hyperbolic services.
"""

from .types import WalletLinkResponse


def format_wallet_link_response(response_data: WalletLinkResponse, wallet_address: str) -> str:
    """Format wallet linking response into a readable string.

    Args:
        response_data: WalletLinkResponse object from wallet linking API.
        wallet_address: Optional wallet address to include in the output.

    Returns:
        str: Formatted response string with next steps.

    """
    output = []

    output.append(response_data.model_dump_json(indent=2))

    if response_data.success is True:
        output.append(f"wallet_address: {wallet_address}")

    hyperbolic_address = "0xd3cB24E0Ba20865C530831C85Bd6EbC25f6f3B60"
    next_steps = (
        "\nNext Steps:\n"
        "1. Your wallet has been successfully linked to your Hyperbolic account\n"
        "2. To add funds, send any of these tokens on Base Mainnet:\n"
        "   - USDC\n"
        "   - USDT\n"
        "   - DAI\n"
        f"3. Send to this Hyperbolic address: {hyperbolic_address}"
    )

    output.append(next_steps)

    return "\n".join(output)


__all__ = [
    "format_wallet_link_response",
]
