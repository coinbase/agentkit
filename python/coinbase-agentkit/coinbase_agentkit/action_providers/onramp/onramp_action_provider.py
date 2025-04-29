"""Onramp action provider for cryptocurrency purchases."""

from typing import Any

from ...network import Network
from ...wallet_providers.evm_wallet_provider import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import GetOnrampBuyUrlSchema
from .utils import convert_network_id_to_onramp_network_id, get_onramp_buy_url


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
            args: Action arguments (unused)

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
            raise ValueError(
                "Network ID is not supported. Make sure you are using a supported mainnet network."
            )

        return get_onramp_buy_url(
            project_id=self.project_id,
            address=wallet_provider.get_address(),
            network=network,
        )

    def supports_network(self, network: Network) -> bool:
        """Check if the network is supported by this provider.

        Args:
            network: The network to check

        Returns:
            True if the network is supported (must be EVM network with supported network ID)

        """
        return bool(
            network.network_id
            and convert_network_id_to_onramp_network_id(network.network_id) is not None
            and network.protocol_family == "evm"
        )


def onramp_action_provider(project_id: str) -> OnrampActionProvider:
    """Create a new OnrampActionProvider instance.

    Args:
        project_id: The Coinbase project ID for onramp services

    Returns:
        A new OnrampActionProvider instance

    """
    return OnrampActionProvider(project_id=project_id)
