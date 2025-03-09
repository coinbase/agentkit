"""Service for billing-related operations."""

from typing import Any

from ..constants import BILLING_BASE_URL, BILLING_ENDPOINTS
from .models import (
    BillingBalanceResponse,
    BillingPurchaseHistoryResponse,
)
from ..service import Base


class BillingService(Base):
    """Service for billing-related operations."""

    def __init__(self, api_key: str):
        """Initialize the billing service.

        Args:
            api_key: The API key for authentication.

        """
        super().__init__(api_key, BILLING_BASE_URL)

    def get_balance(self) -> BillingBalanceResponse:
        """Get current balance information.

        Returns:
            BillingBalanceResponse: The balance data.
        """
        response = self.make_request(endpoint=BILLING_ENDPOINTS["GET_BALANCE"], method="GET")
        return BillingBalanceResponse(**response.json())

    def get_purchase_history(self) -> BillingPurchaseHistoryResponse:
        """Get purchase history.

        Returns:
            BillingPurchaseHistoryResponse: The purchase history data.
        """
        response = self.make_request(endpoint=BILLING_ENDPOINTS["PURCHASE_HISTORY"], method="GET")
        return BillingPurchaseHistoryResponse(**response.json()) 