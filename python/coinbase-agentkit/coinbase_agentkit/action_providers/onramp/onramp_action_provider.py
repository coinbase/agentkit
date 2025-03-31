"""Onramp action provider for cryptocurrency purchases."""

import json
from typing import Any
from urllib.parse import urlencode

from ...network import Network
from ...wallet_providers.evm_wallet_provider import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import GetOnrampBuyUrlSchema
from .utils.constants import ONRAMP_BUY_URL, VERSION
from .utils.network_conversion import convert_network_id_to_onramp_network_id


class OnrampActionProvider(ActionProvider[EvmWalletProvider]):
    """Provides actions for cryptocurrency onramp operations.

    This provider enables users to purchase cryptocurrency using fiat currency
    through Coinbase's onramp service.
    """

    def __init__(self, project_id: str):
        """Initialize the OnrampActionProvider.

        Args:
            project_id: The Coinbase project ID for onramp services

        """
        super().__init__("onramp", [])
        self.project_id = project_id

    @create_action(
        name="get_onramp_buy_url",
        description="""
Get a URL to purchase more cryptocurrency when funds are low. This action provides a link to buy more cryptocurrency (ETH, USDC, or BTC) using fiat currency (regular money like USD).

Use this when:
- You detect that the wallet has insufficient funds for a transaction
- You need to guide the user to purchase more cryptocurrency
- The user asks how to buy more crypto

The URL will direct to a secure Coinbase-powered purchase interface.
""",
        schema=GetOnrampBuyUrlSchema,
    )
    def get_onramp_buy_url(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Get a URL for purchasing cryptocurrency through Coinbase's onramp service.

        Args:
            wallet_provider: The wallet provider instance
            args: Action arguments containing the asset to purchase

        Returns:
            The URL for purchasing cryptocurrency

        Raises:
            ValueError: If the network is not supported or not set

        """
        network_id = wallet_provider.get_network().network_id
        if not network_id:
            raise ValueError("Network ID is not set")

        network = convert_network_id_to_onramp_network_id(network_id)
        if not network:
            raise ValueError("Network ID is not supported")

        # Build URL parameters
        params = {
            "appId": self.project_id,
            "addresses": json.dumps({wallet_provider.get_address(): [network]}),
            "defaultAsset": args["asset"],
            "defaultNetwork": network,
            "sdkVersion": f"onchainkit@{VERSION}",
        }

        # Remove None values and convert all values to strings
        cleaned_params = {k: str(v) for k, v in params.items() if v is not None}

        # Build and return URL
        query = urlencode(sorted(cleaned_params.items()))
        return f"{ONRAMP_BUY_URL}?{query}"

    def supports_network(self, network: Network) -> bool:
        """Check if the network is supported by this provider.

        Args:
            network: The network to check

        Returns:
            True if the network is supported (EVM networks only)

        """
        return network.protocol_family == "evm"


def onramp_action_provider(project_id: str) -> OnrampActionProvider:
    """Create a new OnrampActionProvider instance.

    Args:
        project_id: The Coinbase project ID for onramp services

    Returns:
        A new OnrampActionProvider instance

    """
    return OnrampActionProvider(project_id=project_id)
