"""Service for account settings operations."""

from typing import Any

from ..constants import SETTINGS_BASE_URL, SETTINGS_ENDPOINTS
from .base import Base


class Settings(Base):
    """Service for account settings operations."""

    def __init__(self, api_key: str):
        """Initialize the settings service.

        Args:
            api_key: The API key for authentication.

        """
        super().__init__(api_key, SETTINGS_BASE_URL)

    def link_wallet(self, wallet_address: str) -> dict[str, Any]:
        """Link a wallet address to the Hyperbolic account.

        Args:
            wallet_address: The wallet address to link.

        Returns:
            dict[str, Any]: The wallet linking response data.

        Raises:
            requests.exceptions.RequestException: If the API request fails.

        """
        return self.make_request(
            endpoint=SETTINGS_ENDPOINTS["LINK_WALLET"], data={"wallet_address": wallet_address}
        ) 