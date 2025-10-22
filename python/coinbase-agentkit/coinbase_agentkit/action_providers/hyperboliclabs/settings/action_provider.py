"""Hyperbolic Settings action provider.

This module provides actions for interacting with Hyperbolic settings services.
It includes functionality for managing account settings like wallet linking.
"""

from typing import Any

from ...action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import LinkWalletAddressSchema
from .service import SettingsService
from .types import WalletLinkRequest
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
        super().__init__("hyperbolic_settings", [], api_key=api_key)
        self.settings = SettingsService(self.api_key)

    @create_action(
        name="link_wallet_address",
        description="""
This tool links a wallet address to your Hyperbolic account.

Required inputs:
- address: The wallet address to link to your Hyperbolic account

Example successful response:
    {
      "success": true,
      "error_code": null,
      "message": null
    }
    wallet_address: 0x5E83884F5d399131bbDe98f60854E43c7A12Cf7A

    Next Steps:
    1. Your wallet has been successfully linked to your Hyperbolic account
    2. To add funds, send any of these tokens on Base Mainnet:
       - USDC
       - USDT
       - DAI
    3. Send to this Hyperbolic address: 0xd3cB24E0Ba20865C530831C85Bd6EbC25f6f3B60

Example error response:
    Error: Invalid wallet address format
    Error: API request failed

Important notes:
- The wallet address must be a valid 0x formatted Ethereum address
- If no address is provided, you can get the user's wallet address
""",
        schema=LinkWalletAddressSchema,
    )
    def link_wallet_address(self, args: dict[str, Any]) -> str:
        """Links a wallet address to your Hyperbolic account.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        validated_args = LinkWalletAddressSchema(**args)

        try:
            request = WalletLinkRequest(address=validated_args.address)
            response = self.settings.link_wallet(request)

            return format_wallet_link_response(response, validated_args.address)

        except Exception as e:
            return f"Error: Wallet linking: {e!s}"


def hyperbolic_settings_action_provider(
    api_key: str | None = None,
) -> SettingsActionProvider:
    """Create a new instance of the SettingsActionProvider.

    Args:
        api_key: Optional API key for authentication. If not provided,
                will attempt to read from HYPERBOLIC_API_KEY environment variable.

    Returns:
        A new Settings action provider instance.

    Raises:
        ValueError: If API key is not provided and not found in environment.

    """
    return SettingsActionProvider(api_key=api_key)
