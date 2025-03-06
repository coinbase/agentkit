"""Hyperbolic action provider.

This module provides a unified interface to all Hyperbolic platform services.
It includes sub-providers for marketplace (GPU compute), billing, AI services, and account settings.
"""

from ...network import Network
from ..action_provider import ActionProvider
from .ai.action_provider import (
    AIActionProvider,
)
from .billing.action_provider import (
    BillingActionProvider,
)
from .marketplace.action_provider import (
    MarketplaceActionProvider,
)
from .settings.action_provider import (
    SettingsActionProvider,
)
from .utils import get_api_key


class HyperbolicActionProvider(ActionProvider):
    """Provides unified access to all Hyperbolic platform services.

    This provider aggregates functionality from all Hyperbolic action providers:
    - ai: text, image, and audio generation
    - billing: balance, spending history
    - marketplace: GPU compute resources
    - settings: account settings management

    It requires an API key which can be provided directly or through the
    HYPERBOLIC_API_KEY environment variable.
    """

    def __init__(
        self,
        api_key: str | None = None,
    ):
        """Initialize the Hyperbolic action provider with all sub-providers.

        Args:
            api_key: Optional API key for authentication. If not provided,
                    will attempt to read from HYPERBOLIC_API_KEY environment variable.

        Raises:
            ValueError: If API key is not provided and not found in environment.

        """
        try:
            api_key = api_key or get_api_key()
        except ValueError as e:
            raise ValueError(
                f"{e!s} Please provide it directly "
                "or set the HYPERBOLIC_API_KEY environment variable."
            ) from e

        self.marketplace_provider = MarketplaceActionProvider(api_key)
        self.billing_provider = BillingActionProvider(api_key)
        self.ai_provider = AIActionProvider(api_key)
        self.settings_provider = SettingsActionProvider(api_key)

        super().__init__(
            "hyperbolic",
            [
                self.marketplace_provider,
                self.billing_provider,
                self.ai_provider,
                self.settings_provider,
            ],
        )

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by Hyperbolic actions.

        Args:
            network: The network to check.

        Returns:
            bool: True, as Hyperbolic actions don't require any specific network.

        """
        return True


def hyperbolic_action_provider(
    api_key: str | None = None,
) -> HyperbolicActionProvider:
    """Create a new instance of the HyperbolicActionProvider.

    Args:
        api_key: Optional API key for authentication. If not provided,
                will attempt to read from HYPERBOLIC_API_KEY environment variable.

    Returns:
        A new Hyperbolic action provider instance.

    """
    return HyperbolicActionProvider(api_key=api_key)
