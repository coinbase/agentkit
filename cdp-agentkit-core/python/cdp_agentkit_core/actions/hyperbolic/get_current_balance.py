from collections.abc import Callable
from datetime import datetime

import requests
from pydantic import BaseModel

from cdp_agentkit_core.actions import CdpAction
from cdp_agentkit_core.actions.hyperbolic.utils import get_api_key

GET_CURRENT_BALANCE_PROMPT = """
This tool retrieves your current Hyperbolic platform credit balance.
It shows:
- Available Hyperbolic platform credits in your account (in USD)
- Recent credit purchase history
Note: This is NOT for checking cryptocurrency wallet balances (ETH/USDC).
For crypto wallet balances, please use a different command.
No input parameters required.
"""


class GetCurrentBalanceInput(BaseModel):
    """Input argument schema for getting current balance."""

    pass


def get_current_balance() -> str:
    """Retrieve current balance and purchase history from the account.

    Returns:
        str: Formatted current balance and purchase history information

    """
    api_key = get_api_key()
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}

    try:
        # Get current balance
        balance_url = "https://api.hyperbolic.xyz/billing/get_current_balance"
        balance_response = requests.get(balance_url, headers=headers)
        balance_response.raise_for_status()
        balance_data = balance_response.json()

        # Get purchase history
        history_url = "https://api.hyperbolic.xyz/billing/purchase_history"
        history_response = requests.get(history_url, headers=headers)
        history_response.raise_for_status()
        history_data = history_response.json()

        # Format the output
        credits = balance_data.get("credits", 0)
        balance_usd = credits / 100  # Convert tokens to dollars

        output = [f"Your current Hyperbolic platform balance is ${balance_usd:.2f}."]

        purchases = history_data.get("purchase_history", [])
        if purchases:
            output.append("\nPurchase History:")
            for purchase in purchases:
                amount = float(purchase["amount"]) / 100
                timestamp = datetime.fromisoformat(purchase["timestamp"])
                formatted_date = timestamp.strftime("%B %d, %Y")
                output.append(f"- ${amount:.2f} on {formatted_date}")
        else:
            output.append("\nNo previous purchases found.")

        return "\n".join(output)

    except requests.exceptions.RequestException as e:
        return f"Error retrieving balance information: {e!s}"


class GetCurrentBalanceAction(CdpAction):
    """Get current balance action."""

    name: str = "get_current_balance"
    description: str = GET_CURRENT_BALANCE_PROMPT
    args_schema: type[BaseModel] | None = GetCurrentBalanceInput
    func: Callable[..., str] = get_current_balance
