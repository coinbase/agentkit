"""Service for billing-related operations."""

from typing import Any

from ..constants import BILLING_BASE_URL, BILLING_ENDPOINTS
from .models import (
    BillingBalanceResponse,
    BillingPurchaseHistoryResponse,
    InstanceHistoryResponse,
)
from ..service import Base


class Billing(Base):
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

        Raises:
            requests.exceptions.RequestException: If the API request fails.
            pydantic.ValidationError: If response validation fails.

        """
        response_data = self.make_request(endpoint=BILLING_ENDPOINTS["GET_BALANCE"], method="GET")
        return BillingBalanceResponse(**response_data)

    def get_purchase_history(self) -> BillingPurchaseHistoryResponse:
        """Get purchase history.

        Returns:
            BillingPurchaseHistoryResponse: The purchase history data.

        Raises:
            requests.exceptions.RequestException: If the API request fails.
            pydantic.ValidationError: If response validation fails.

        """
        response_data = self.make_request(endpoint=BILLING_ENDPOINTS["PURCHASE_HISTORY"], method="GET")
        return BillingPurchaseHistoryResponse(**response_data)
        
    def get_instance_history(self) -> InstanceHistoryResponse:
        """Get instance rental history.

        Returns:
            InstanceHistoryResponse: The instance history data.

        Raises:
            requests.exceptions.RequestException: If the API request fails.
            pydantic.ValidationError: If response validation fails.

        """
        response_data = self.make_request(endpoint=BILLING_ENDPOINTS["INSTANCE_HISTORY"], method="GET")
        return InstanceHistoryResponse(**response_data) 