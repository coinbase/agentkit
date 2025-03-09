"""Hyperbolic Settings action provider.

This module provides actions for interacting with Hyperbolic settings services.
It includes functionality for managing account settings like wallet linking.
"""

from typing import Any

from ....network import Network
from ...action_decorator import create_action
from ...action_provider import ActionProvider
from ..utils import get_api_key
from .models import WalletLinkRequest
from .schemas import LinkWalletAddressSchema
from .service import SettingsService
from .utils import format_wallet_link_response


class SettingsActionProvider(ActionProvider):
    """Provides actions for interacting with Hyperbolic settings.

    This provider enables interaction with the Hyperbolic settings services for managing
    account settings. It requires an API key which can be provided directly or
    through the HYPERBOLIC_API_KEY environment variable.
    """

    def __init__(
        self,
        api_key: str | None = None,
    ):
        """Initialize the Hyperbolic settings action provider.

        Args:
            api_key: Optional API key for authentication. If not provided,
                    will attempt to read from HYPERBOLIC_API_KEY environment variable.

        Raises:
            ValueError: If API key is not provided and not found in environment.

        """
        super().__init__("hyperbolic_settings", [])

        try:
            self.api_key = api_key or get_api_key()
        except ValueError as e:
            raise ValueError(
                f"{e!s} Please provide it directly "
                "or set the HYPERBOLIC_API_KEY environment variable."
            ) from e

        self.settings = SettingsService(self.api_key)

    @create_action(
        name="link_wallet_address",
        description="""
This tool links a wallet address to your Hyperbolic account.

Required inputs:
- address: The wallet address to link to your Hyperbolic account

Example successful response:
    {
      "status": "success",
      "message": "Wallet address linked successfully"
    }

    Next Steps:
    1. Your wallet has been successfully linked
    2. To add funds, send any of these tokens on Base network:
       - USDC
       - USDT
       - DAI
    3. Send to this Hyperbolic address: 0xd3cB24E0Ba20865C530831C85Bd6EbC25f6f3B60

A failure response will return an error message like:
    Error linking wallet address: Invalid wallet address format
    Error linking wallet address: API request failed

Notes:
- Authorization key is required
- The wallet address must be a valid Ethereum address
- After linking, you can send USDC, USDT, or DAI on Base network
""",
        schema=LinkWalletAddressSchema,
    )
    def link_wallet_address(self, args: dict[str, Any]) -> str:
        """Link a wallet address to your Hyperbolic account.

        Args:
            args (dict[str, Any]): Dictionary containing:
                - address: The wallet address to link.

        Returns:
            str: A message containing the linking response and next steps.

        """
        validated_args = LinkWalletAddressSchema(**args)

        try:
            # Link the wallet address
            request = WalletLinkRequest(address=validated_args.address)
            response = self.settings.link_wallet(request)

            # Format the response with next steps
            return format_wallet_link_response(response)

        except Exception as e:
            return f"Error linking wallet address: {e}"

    def supports_network(self, _: Network) -> bool:
        """Check if network is supported by Hyperbolic settings actions.

        Args:
            _ (Network): The network to check support for.

        Returns:
            bool: Always True as Hyperbolic settings actions don't depend on blockchain networks.

        """
        return True


def hyperbolic_settings_action_provider(
    api_key: str | None = None,
) -> SettingsActionProvider:
    """Create and return a new HyperbolicSettingsActionProvider instance.

    Args:
        api_key: Optional API key for authentication. If not provided,
                will attempt to read from HYPERBOLIC_API_KEY environment variable.

    Returns:
        HyperbolicSettingsActionProvider: A new instance of the Hyperbolic settings action provider.

    Raises:
        ValueError: If API key is not provided and not found in environment.

    """
    return SettingsActionProvider(api_key=api_key)
