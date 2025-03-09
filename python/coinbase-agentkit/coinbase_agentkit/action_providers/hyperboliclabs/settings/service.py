"""Service for account settings operations."""

from typing import Any

from ..constants import SETTINGS_BASE_URL, SETTINGS_ENDPOINTS
from ..service import Base
from .models import WalletLinkResponse


class Settings(Base):
    """Service for account settings operations."""

    def __init__(self, api_key: str):
        """Initialize the settings service.

        Args:
            api_key: The API key for authentication.

        """
        super().__init__(api_key, SETTINGS_BASE_URL)

    def link_wallet(self, wallet_address: str) -> WalletLinkResponse:
        """Link a wallet address to the Hyperbolic account.

        Args:
            wallet_address: The wallet address to link.

        Returns:
            WalletLinkResponse: The wallet linking response data.

        Raises:
            requests.exceptions.RequestException: If the API request fails.

        """
        response_data = self.make_request(
            endpoint=SETTINGS_ENDPOINTS["LINK_WALLET"], data={"wallet_address": wallet_address}
        )
        
        return WalletLinkResponse.model_validate(response_data) 