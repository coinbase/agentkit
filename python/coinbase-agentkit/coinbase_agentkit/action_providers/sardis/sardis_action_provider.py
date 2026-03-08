"""Sardis payment action provider."""

import os
from json import dumps
from typing import Any

import requests

from ...network import Network
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .constants import SARDIS_API_BASE_URL
from .schemas import (
    SardisCheckBalanceSchema,
    SardisCheckPolicySchema,
    SardisListTransactionsSchema,
    SardisPaySchema,
    SardisSetPolicySchema,
)


class SardisActionProvider(ActionProvider):
    """Provides actions for policy-controlled AI agent payments via Sardis.

    Sardis is the Payment OS for the Agent Economy — infrastructure enabling
    AI agents to make real financial transactions safely through non-custodial
    MPC wallets with natural language spending policies.
    """

    def __init__(
        self,
        api_key: str | None = None,
        wallet_id: str | None = None,
        base_url: str | None = None,
    ):
        super().__init__("sardis", [])

        self.api_key = api_key or os.getenv("SARDIS_API_KEY")
        self.wallet_id = wallet_id or os.getenv("SARDIS_WALLET_ID")
        self.base_url = base_url or os.getenv("SARDIS_API_BASE_URL", SARDIS_API_BASE_URL)

        if not self.api_key:
            raise ValueError(
                "SARDIS_API_KEY is not configured. "
                "Get one at https://sardis.sh/dashboard"
            )
        if not self.wallet_id:
            raise ValueError(
                "SARDIS_WALLET_ID is not configured. "
                "Create a wallet at https://sardis.sh/dashboard"
            )

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "coinbase-agentkit-sardis/1.0",
        }

    def _post(self, path: str, data: dict) -> dict:
        resp = requests.post(
            f"{self.base_url}{path}",
            json=data,
            headers=self._headers(),
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()

    def _get(self, path: str, params: dict | None = None) -> dict:
        resp = requests.get(
            f"{self.base_url}{path}",
            params=params,
            headers=self._headers(),
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()

    @create_action(
        name="sardis_pay",
        description="""
Execute a policy-controlled payment through Sardis.

Use this tool when the user asks to send money, pay a merchant, transfer funds,
or make any kind of payment. Sardis enforces the wallet's spending policy
automatically — if the payment violates a limit the transaction will be
rejected and the response will explain why.

A successful response will return a JSON payload:
    {"success": true, "tx_id": "tx_abc123", "status": "executed", "amount": "25.00", "to": "openai.com", "token": "USDC"}

A failure response will return an error message:
    Error executing payment: Policy violation - amount exceeds per-transaction limit of $50.00""",
        schema=SardisPaySchema,
    )
    def sardis_pay(self, args: dict[str, Any]) -> str:
        """Execute a payment with automatic policy enforcement.

        Args:
            args: Dictionary containing to, amount, token, and purpose fields.

        Returns:
            str: A message containing the payment result or error details.

        """
        validated = SardisPaySchema(**args)

        try:
            result = self._post(f"/wallets/{self.wallet_id}/pay/onchain", {
                "to": validated.to,
                "amount": validated.amount,
                "token": validated.token,
                "chain": "base",
                "memo": validated.purpose or None,
            })
            return f"Successfully executed payment:\n{dumps(result)}"
        except requests.exceptions.HTTPError as e:
            error_body = ""
            if e.response is not None:
                try:
                    error_body = e.response.json().get("detail", str(e))
                except Exception:
                    error_body = e.response.text
            return f"Error executing payment: {error_body or e}"
        except requests.exceptions.RequestException as e:
            return f"Error executing payment: {e}"

    @create_action(
        name="sardis_check_balance",
        description="""
Check the current wallet balance and spending limits.

Use this tool when the user asks about their balance, how much they can still
spend, remaining limits, or anything related to wallet funds.

A successful response will return a JSON payload:
    {"wallet_id": "wal_abc", "balance": 1250.00, "token": "USDC", "chain": "base", "remaining": 750.00}

A failure response will return an error message:
    Error checking balance: 401 Unauthorized""",
        schema=SardisCheckBalanceSchema,
    )
    def sardis_check_balance(self, args: dict[str, Any]) -> str:
        """Check wallet balance and spending limits.

        Args:
            args: Dictionary containing token and chain fields.

        Returns:
            str: A message containing the balance info or error details.

        """
        validated = SardisCheckBalanceSchema(**args)

        try:
            result = self._get(
                f"/wallets/{self.wallet_id}/balance",
                params={"token": validated.token, "chain": validated.chain},
            )
            return f"Successfully retrieved wallet balance:\n{dumps(result)}"
        except requests.exceptions.HTTPError as e:
            error_body = ""
            if e.response is not None:
                try:
                    error_body = e.response.json().get("detail", str(e))
                except Exception:
                    error_body = e.response.text
            return f"Error checking balance: {error_body or e}"
        except requests.exceptions.RequestException as e:
            return f"Error checking balance: {e}"

    @create_action(
        name="sardis_check_policy",
        description="""
Check whether a payment would be allowed by the wallet's spending policy.

Use this tool BEFORE making a payment if the user wants to verify whether a
transaction will succeed, or when they ask "can I pay X?" or "would this be
allowed?". This does NOT execute the payment — it is a dry-run validation.

A successful response will return a JSON payload:
    {"allowed": true, "reason": "All policy checks passed", "checks_passed": ["amount_limit", "vendor_allowlist"]}

A failure response will return an error message:
    Error checking policy: 401 Unauthorized""",
        schema=SardisCheckPolicySchema,
    )
    def sardis_check_policy(self, args: dict[str, Any]) -> str:
        """Dry-run policy validation for a payment.

        Args:
            args: Dictionary containing to, amount, token, and purpose fields.

        Returns:
            str: A message containing the policy check result or error details.

        """
        validated = SardisCheckPolicySchema(**args)

        try:
            result = self._post("/policies/check", {
                "agent_id": self.wallet_id,
                "amount": validated.amount,
                "currency": validated.token,
                "merchant_id": validated.to,
            })
            return f"Successfully checked payment policy:\n{dumps(result)}"
        except requests.exceptions.HTTPError as e:
            error_body = ""
            if e.response is not None:
                try:
                    error_body = e.response.json().get("detail", str(e))
                except Exception:
                    error_body = e.response.text
            return f"Error checking policy: {error_body or e}"
        except requests.exceptions.RequestException as e:
            return f"Error checking policy: {e}"

    @create_action(
        name="sardis_set_policy",
        description="""
Set or update the spending policy on the wallet using natural language.

Use this tool when the user says things like "set my limit to $50 per
transaction", "change daily budget to $500", or gives any natural-language
spending rule.

A successful response will return a JSON payload:
    {"success": true, "wallet_id": "wal_abc", "limit_per_tx": 50.0, "limit_total": 500.0, "policy_text": "Max $50/tx, daily limit $500"}

A failure response will return an error message:
    Error setting policy: 403 Forbidden""",
        schema=SardisSetPolicySchema,
    )
    def sardis_set_policy(self, args: dict[str, Any]) -> str:
        """Set spending policy with natural language parsing.

        Args:
            args: Dictionary containing policy_text, max_per_tx, and max_total fields.

        Returns:
            str: A message containing the policy update result or error details.

        """
        validated = SardisSetPolicySchema(**args)

        payload: dict[str, Any] = {
            "natural_language": validated.policy_text,
            "agent_id": self.wallet_id,
            "confirm": True,
        }

        try:
            result = self._post("/policies/apply", payload)
            return f"Successfully updated spending policy:\n{dumps(result)}"
        except requests.exceptions.HTTPError as e:
            error_body = ""
            if e.response is not None:
                try:
                    error_body = e.response.json().get("detail", str(e))
                except Exception:
                    error_body = e.response.text
            return f"Error setting policy: {error_body or e}"
        except requests.exceptions.RequestException as e:
            return f"Error setting policy: {e}"

    @create_action(
        name="sardis_list_transactions",
        description="""
List recent transactions from the wallet's ledger.

Use this tool when the user asks to see their transaction history, recent
payments, spending activity, or audit trail.

A successful response will return a JSON payload:
    {"wallet_id": "wal_abc", "count": 3, "transactions": [{"tx_id": "tx_1", "amount": "25.00", "to": "openai.com", "status": "executed"}]}

A failure response will return an error message:
    Error listing transactions: 401 Unauthorized""",
        schema=SardisListTransactionsSchema,
    )
    def sardis_list_transactions(self, args: dict[str, Any]) -> str:
        """Retrieve transaction history.

        Args:
            args: Dictionary containing limit field.

        Returns:
            str: A message containing the transaction list or error details.

        """
        validated = SardisListTransactionsSchema(**args)
        capped_limit = min(validated.limit, 50)

        try:
            result = self._get(
                "/ledger/entries",
                params={"wallet_id": self.wallet_id, "limit": capped_limit},
            )
            return f"Successfully retrieved transaction history:\n{dumps(result)}"
        except requests.exceptions.HTTPError as e:
            error_body = ""
            if e.response is not None:
                try:
                    error_body = e.response.json().get("detail", str(e))
                except Exception:
                    error_body = e.response.text
            return f"Error listing transactions: {error_body or e}"
        except requests.exceptions.RequestException as e:
            return f"Error listing transactions: {e}"

    def supports_network(self, network: Network) -> bool:
        """Check if network is supported by Sardis payment actions.

        Sardis supports EVM networks including Base, Polygon, Ethereum,
        Arbitrum, and Optimism.

        Returns:
            bool: True if the network is an EVM network.

        """
        return network.protocol_family == "evm"


def sardis_action_provider(
    api_key: str | None = None,
    wallet_id: str | None = None,
    base_url: str | None = None,
) -> SardisActionProvider:
    """Create and return a new SardisActionProvider instance.

    Args:
        api_key: Sardis API key. Falls back to SARDIS_API_KEY env var.
        wallet_id: Sardis wallet ID. Falls back to SARDIS_WALLET_ID env var.
        base_url: Override the Sardis API base URL.

    Returns:
        SardisActionProvider: Configured provider instance.

    """
    return SardisActionProvider(
        api_key=api_key,
        wallet_id=wallet_id,
        base_url=base_url,
    )
