"""Service for account settings-related operations."""

from ..constants import SETTINGS_BASE_URL, SETTINGS_ENDPOINTS
from ..service import Base
from .types import WalletLinkRequest, WalletLinkResponse


class SettingsService(Base):
    """Service for account settings operations."""

    def __init__(self, api_key: str):
        """Initialize the settings service.

        Args:
            api_key: The API key for authentication.

        """
        super().__init__(api_key, SETTINGS_BASE_URL)

    def link_wallet(self, request: WalletLinkRequest) -> WalletLinkResponse:
        """Link a wallet address to the Hyperbolic account.

        Args:
            request: The wallet link request containing the wallet address.

        Returns:
            WalletLinkResponse: The wallet linking response data.

        """
        response = self.make_request(
            endpoint=SETTINGS_ENDPOINTS["LINK_WALLET"], data=request.model_dump()
        )
        return WalletLinkResponse(**response.json())
