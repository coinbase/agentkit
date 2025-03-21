"""Base class for Hyperbolic action providers.

This module provides a base class for all Hyperbolic action providers
with centralized API key handling.
"""

from ...network import Network
from ..action_provider import ActionProvider, TWalletProvider
from .utils import get_api_key


class ActionProvider(ActionProvider[TWalletProvider]):
    """Base class for all Hyperbolic action providers.

    This base class centralizes API key handling for all Hyperbolic action providers.
    It requires an API key which can be provided directly or through the
    HYPERBOLIC_API_KEY environment variable.
    """

    def __init__(
        self,
        name: str,
        action_providers: list["ActionProvider[TWalletProvider]"],
        api_key: str | None = None,
    ):
        """Initialize the Hyperbolic base action provider.

        Args:
            name: The name of the action provider.
            action_providers: List of sub-providers.
            api_key: Optional API key for authentication. If not provided,
                    will attempt to read from HYPERBOLIC_API_KEY environment variable.

        Raises:
            ValueError: If API key is not provided and not found in environment.

        """
        try:
            self.api_key = api_key or get_api_key()
        except ValueError as e:
            raise ValueError(
                f"{e!s} Please provide it directly "
                "or set the HYPERBOLIC_API_KEY environment variable."
            ) from e

        super().__init__(name, action_providers)

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by Hyperbolic actions.

        Hyperbolic services are not network-specific, so this always returns True.

        Args:
            network: The network to check.

        Returns:
            bool: Always True as Hyperbolic services are network-agnostic.

        """
        return True
