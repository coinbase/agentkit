"""HirePulse public company data, without automatic wallet access."""

import json
from typing import Any

import requests

from ...network import Network
from ...wallet_providers import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import CompanyLookupSchema, CompanyScanSchema

BASE_URL = "https://gethirepulse.xyz"


class HirePulseActionProvider(ActionProvider[WalletProvider]):
    """Provide company lookups and free quotes; return payment challenges unchanged."""

    def __init__(self) -> None:
        super().__init__("hirepulse", [])

    def _request(self, tool: str, body: dict[str, Any]) -> str:
        try:
            response = requests.post(
                f"{BASE_URL}/v1/{tool}",
                json=body,
                timeout=120,
                allow_redirects=False,
                headers={"User-Agent": "coinbase-agentkit/hirepulse"},
            )
            data = response.json()
        except (requests.RequestException, ValueError):
            return json.dumps({"error": "HirePulse request failed; not retried."})
        return json.dumps(
            {
                "http_status": response.status_code,
                "data": data,
                "payment_required": response.headers.get("PAYMENT-REQUIRED"),
            }
        )

    @create_action(
        name="company_lookup",
        description="""Retrieve public company data from HirePulse by domain, e.g. linear.app.
Choose tech-stack (website technologies), ats-jobs (open jobs), company-intent
(hiring signals), google-ads (Google Ads transparency), company-profile (combined
data), or company-footprint (public operating signals). Five successful lookups
per UTC day per IP are shared across tools. Further successful results cost
$0.005-$0.03 USDC on Base via x402. Empty results are not charged. This action
never signs payments; HTTP 402 includes the payment challenge instead of data.
""",
        schema=CompanyLookupSchema,
    )
    def company_lookup(self, args: dict[str, Any]) -> str:
        """Retrieve one validated company lookup."""
        validated = CompanyLookupSchema(**args)
        return self._request(validated.tool, {"domain": validated.domain})

    @create_action(
        name="company_scan",
        description="""Create a free HirePulse quote for 2-25 company domains.
operation=batch quotes one selected lookup for all domains; operation=hot-buyers
screens hiring scores using min_intent_score (default 70). Returns statuses and
a quote_id when data is available. Three scans per day per IP per scan endpoint.
Does not purchase the quote or return paid profiles. Hot profiles are $0.25 per
hot company; batch prices depend on rows with data. Quotes expire in 15 minutes.
""",
        schema=CompanyScanSchema,
    )
    def company_scan(self, args: dict[str, Any]) -> str:
        """Create a quote without signing a payment."""
        validated = CompanyScanSchema(**args)
        body: dict[str, Any] = {"domains": validated.domains}
        if validated.operation == "batch":
            body["tool"] = validated.tool
        else:
            body["min_intent_score"] = validated.min_intent_score
        return self._request(validated.operation, body)

    def supports_network(self, network: Network) -> bool:
        """Support all wallet networks because this provider never uses a wallet."""
        return True


def hirepulse_action_provider() -> HirePulseActionProvider:
    """Create the HirePulse company-data action provider."""
    return HirePulseActionProvider()
