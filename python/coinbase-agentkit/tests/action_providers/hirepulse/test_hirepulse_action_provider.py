"""HirePulse tests never use a wallet or the live service."""

import json
from unittest.mock import patch

import pytest
import requests
from pydantic import ValidationError

from coinbase_agentkit.action_providers.hirepulse import hirepulse_action_provider


@pytest.fixture(autouse=True)
def disable_analytics(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep unit tests offline, including AgentKit's action telemetry."""
    monkeypatch.setattr(
        "coinbase_agentkit.action_providers.action_decorator.send_analytics_event",
        lambda *args, **kwargs: None,
    )


def test_lookup_preserves_result() -> None:
    """Send a single fixed-origin request and preserve public data."""
    with patch("requests.post") as post:
        post.return_value.status_code = 200
        post.return_value.json.return_value = {"status": "ok"}
        post.return_value.headers = {}
        result = json.loads(
            hirepulse_action_provider().company_lookup(
                {"tool": "company-intent", "domain": "linear.app"}
            )
        )
        assert result["data"] == {"status": "ok"}
        post.assert_called_once_with(
            "https://gethirepulse.xyz/v1/company-intent",
            json={"domain": "linear.app"},
            timeout=120,
            allow_redirects=False,
            headers={"User-Agent": "coinbase-agentkit/hirepulse"},
        )


def test_payment_required_does_not_retry() -> None:
    """Expose a payment challenge without authorizing or retrying it."""
    with patch("requests.post") as post:
        post.return_value.status_code = 402
        post.return_value.json.return_value = {"x402Version": 2}
        post.return_value.headers = {"PAYMENT-REQUIRED": "challenge"}
        result = json.loads(
            hirepulse_action_provider().company_lookup({"tool": "ats-jobs", "domain": "linear.app"})
        )
        assert result["http_status"] == 402
        assert result["payment_required"] == "challenge"
        assert post.call_count == 1


def test_batch_quote_uses_tool() -> None:
    """A batch request sends the selected lookup without payment headers."""
    with patch("requests.post") as post:
        post.return_value.json.return_value = {"quote_id": "example"}
        post.return_value.status_code = 200
        post.return_value.headers = {}
        hirepulse_action_provider().company_scan(
            {"operation": "batch", "domains": ["linear.app", "ramp.com"], "tool": "tech-stack"}
        )
        assert post.call_args.kwargs["json"] == {
            "domains": ["linear.app", "ramp.com"],
            "tool": "tech-stack",
        }


def test_invalid_lookup_never_reaches_network() -> None:
    """Reject paths and unknown tools before making a request."""
    with patch("requests.post") as post, pytest.raises(ValidationError):
        hirepulse_action_provider().company_lookup({"tool": "../admin", "domain": "linear.app"})
    post.assert_not_called()


def test_network_failure_is_explicit() -> None:
    """An outage is not a successful empty result."""
    with patch("requests.post", side_effect=requests.Timeout):
        result = json.loads(
            hirepulse_action_provider().company_lookup(
                {"tool": "tech-stack", "domain": "linear.app"}
            )
        )
    assert "error" in result
