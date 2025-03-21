"""Hyperbolic Billing action provider.

This module provides actions for interacting with Hyperbolic billing services.
It includes functionality for checking balance and spend history.
"""

from typing import Any

from ...action_decorator import create_action
from ..action_provider import ActionProvider
from ..marketplace.service import MarketplaceService
from .schemas import (
    GetCurrentBalanceSchema,
    GetPurchaseHistorySchema,
    GetSpendHistorySchema,
)
from .service import BillingService
from .utils import (
    format_purchase_history,
    format_spend_history,
)


class BillingActionProvider(ActionProvider):
    """Provides actions for interacting with Hyperbolic billing.

    This provider enables interaction with the Hyperbolic billing services for balance
    and spend history. It requires an API key which can be provided directly or
    through the HYPERBOLIC_API_KEY environment variable.
    """

    def __init__(
        self,
        api_key: str | None = None,
    ):
        """Initialize the Hyperbolic billing action provider.

        Args:
            api_key: Optional API key for authentication. If not provided,
                    will attempt to read from HYPERBOLIC_API_KEY environment variable.

        Raises:
            ValueError: If API key is not provided and not found in environment.

        """
        super().__init__("hyperbolic_billing", [], api_key=api_key)
        self.billing = BillingService(self.api_key)
        self.marketplace = MarketplaceService(self.api_key)

    @create_action(
        name="get_current_balance",
        description="""
This tool retrieves your current Hyperbolic platform credit balance.

It does not take any inputs.

Example successful response:
    Your current Hyperbolic platform balance is $3.61.

Example error response:
    Error: API request failed
    Error: Invalid authentication credentials

Important notes:
- This shows platform credits only, NOT cryptocurrency wallet balances
- All amounts are shown in USD
- Balance is displayed with 2 decimal precision
""",
        schema=GetCurrentBalanceSchema,
    )
    def get_current_balance(self, args: dict[str, Any]) -> str:
        """Retrieve current balance and purchase history from the account.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            GetCurrentBalanceSchema(**args)

            response = self.billing.get_balance()
            balance_usd = float(response.credits) / 100

            return f"Your current Hyperbolic platform balance is ${balance_usd:.2f}.\n"
        except Exception as e:
            return f"Error: Balance retrieval: {e!s}"

    @create_action(
        name="get_spend_history",
        description="""
This tool retrieves your GPU rental spending history from Hyperbolic platform.

It does not take any inputs.

Example successful response:
    === GPU Rental Spending Analysis ===

    Instance Rentals (showing 5 most recent):
    - antique-peach-rhinoceros:
      GPU: NVIDIA-GeForce-RTX-4090 (Count: 1)
      Duration: 225 seconds
      Cost: $0.03
    - clearcut-chrysanthemum-ape:
      GPU: NVIDIA-GeForce-RTX-4090 (Count: 1)
      Duration: 90 seconds
      Cost: $0.01

    GPU Type Statistics (showing 2 most recent):
    NVIDIA-GeForce-RTX-4090:
      Total Rentals: 10.0
      Total Time: 363954 seconds
      Total Cost: $6.80

    NVIDIA-H100-80GB-HBM3:
      Total Rentals: 14.0
      Total Time: 3084 seconds
      Total Cost: $0.16

    Total Spending: $6.96

Example error response:
    Error: API request failed

Important notes:
- All costs are in USD
- Duration is in seconds
- History includes instance names with animal-based identifiers
""",
        schema=GetSpendHistorySchema,
    )
    def get_spend_history(self, args: dict[str, Any]) -> str:
        """Retrieve GPU rental spending history from the platform.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            GetSpendHistorySchema(**args)

            response = self.marketplace.get_instance_history()
            if not response:
                return "Could not retrieve instance history. Please try again later."

            if not response.instance_history:
                return "No rental history found."

            return format_spend_history(response)
        except Exception as e:
            return f"Error: Spend history retrieval: {e!s}"

    @create_action(
        name="get_purchase_history",
        description="""
This tool retrieves your purchase history of Hyperbolic platform credits.

It does not take any inputs.

Example successful response:
    Purchase History (showing 5 most recent):
    - $1.00 on March 06, 2025
    - $10.00 on March 06, 2025

Example error response:
    Error: API request failed
    Error: Invalid authentication credentials
    Error: No previous purchases found

Important notes:
- This shows platform credit purchases only
- All amounts are shown in USD
- Purchase history is limited to 5 most recent by default
""",
        schema=GetPurchaseHistorySchema,
    )
    def get_purchase_history(self, args: dict[str, Any]) -> str:
        """Retrieve the purchase history of platform credits.

        Args:
            args (dict[str, Any]): Input arguments for the action.

        Returns:
            str: A message containing the action response or error details.

        """
        try:
            GetPurchaseHistorySchema(**args)
            history_response = self.billing.get_purchase_history()

            return format_purchase_history(history_response)
        except Exception as e:
            return f"Error: Purchase history retrieval: {e!s}"


def hyperbolic_billing_action_provider(
    api_key: str | None = None,
) -> BillingActionProvider:
    """Create a new instance of the BillingActionProvider.

    Args:
        api_key: Optional API key for authentication. If not provided,
                will attempt to read from HYPERBOLIC_API_KEY environment variable.

    Returns:
        A new Billing action provider instance.

    Raises:
        ValueError: If API key is not provided and not found in environment.

    """
    return BillingActionProvider(api_key=api_key)
