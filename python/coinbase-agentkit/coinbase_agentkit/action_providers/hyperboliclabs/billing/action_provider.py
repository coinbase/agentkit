"""Hyperbolic Billing action provider.

This module provides actions for interacting with Hyperbolic billing services.
It includes functionality for checking balance and spend history.
"""

from typing import Any

from coinbase_agentkit.network import Network

from ...action_decorator import create_action
from ...action_provider import ActionProvider
from ..marketplace.service import MarketplaceService
from ..utils import (
    get_api_key,
)
from .schemas import (
    GetCurrentBalanceSchema,
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
        super().__init__("hyperbolic_billing", [])

        try:
            self.api_key = api_key or get_api_key()
        except ValueError as e:
            raise ValueError(
                f"{e!s} Please provide it directly "
                "or set the HYPERBOLIC_API_KEY environment variable."
            ) from e

        self.billing = BillingService(self.api_key)
        self.marketplace = MarketplaceService(self.api_key)

    @create_action(
        name="get_current_balance",
        description="""
This tool retrieves your current Hyperbolic platform credit balance.

It does not take any inputs.

A successful response will show:
- Available Hyperbolic platform credits in your account (in USD)
- Recent credit purchase history with dates and amounts

Example successful response:
    Your current Hyperbolic platform balance is $150.00.
    Purchase History:
    - $100.00 on January 15, 2024
    - $50.00 on December 30, 2023

A failure response will return an error message like:
    Error retrieving balance information: API request failed
    Error retrieving balance information: Invalid authentication credentials

Important notes:
- Authorization key is required for this operation
- This shows platform credits only, NOT cryptocurrency wallet balances
- All amounts are shown in USD
- Purchase history is ordered from most recent to oldest
""",
        schema=GetCurrentBalanceSchema,
    )
    def get_current_balance(self, args: dict[str, Any]) -> str:
        """Get current balance and purchase history from the account.

        Args:
            args (dict[str, Any]): Empty dictionary, no arguments needed.

        Returns:
            str: A message containing the current balance and purchase history or error details.

        """
        try:
            # Validate arguments using schema
            GetCurrentBalanceSchema(**args)

            # Get balance info
            response = self.billing.get_balance()

            # Format the response
            balance_usd = float(response.credits) / 100  # Convert cents to dollars for display
            output = [f"Your current Hyperbolic platform balance is ${balance_usd:.2f}."]

            # Get and format purchase history
            history_response = self.billing.get_purchase_history()
            output.append(format_purchase_history(history_response))

            return "\n".join(output)

        except Exception as e:
            return f"Error retrieving balance information: {e}"

    @create_action(
        name="get_spend_history",
        description="""
This tool retrieves your GPU rental spending history from Hyperbolic platform.

It does not take any inputs.

A successful response will show:
- List of instances rented with details (GPU model, count, duration, cost)
- Statistics per GPU type (rentals, time, cost)
- Overall total spending

Example response:
    === GPU Rental Spending Analysis ===

    Instance Rentals:
    - instance-123:
      GPU: NVIDIA A100 (Count: 2)
      Duration: 3600 seconds
      Cost: $25.00

    GPU Type Statistics:
    NVIDIA A100:
      Total Rentals: 2
      Total Time: 3600 seconds
      Total Cost: $25.00

    Total Spending: $25.00

A failure response will return an error message like:
    Error retrieving spend history: API request failed

Notes:
- Authorization key is required
- All costs are in USD
- Duration is in seconds
- History includes all past rentals
""",
        schema=GetSpendHistorySchema,
    )
    def get_spend_history(self, args: dict[str, Any]) -> str:
        """Get GPU rental spending history.

        Args:
            args (dict[str, Any]): Empty dictionary, no arguments needed.

        Returns:
            str: A message containing the spend history or error details.

        """
        try:
            # Validate arguments using schema
            GetSpendHistorySchema(**args)

            # Get instance history from marketplace service
            response = self.marketplace.get_instance_history()

            if not response.instance_history:
                return "No rental history found."

            # Format the response
            return format_spend_history(response)

        except Exception as e:
            return f"Error retrieving spend history: {e}"

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by Hyperbolic billing actions.

        Args:
            network (Network): The network to check support for.

        Returns:
            bool: Always True as Hyperbolic billing actions don't depend on blockchain networks.

        """
        return True


def hyperbolic_billing_action_provider(
    api_key: str | None = None,
) -> BillingActionProvider:
    """Create and return a new HyperbolicBillingActionProvider instance.

    Args:
        api_key: Optional API key for authentication. If not provided,
                will attempt to read from HYPERBOLIC_API_KEY environment variable.

    Returns:
        HyperbolicBillingActionProvider: A new instance of the Hyperbolic billing action provider.

    Raises:
        ValueError: If API key is not provided and not found in environment.

    """
    return BillingActionProvider(api_key=api_key)
