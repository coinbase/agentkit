"""Tests for NEXUS action provider."""

from unittest.mock import MagicMock, patch

import pytest

from coinbase_agentkit.action_providers.nexus.nexus_action_provider import NexusActionProvider


@pytest.fixture
def provider():
    return NexusActionProvider()


def test_get_kalshi_consensus(provider):
    mock_response = MagicMock()
    mock_response.ok = True
    mock_response.json.return_value = {
        "count": 2,
        "markets": [{"probability_pct": 47.0, "title": "Fed rate"}],
    }
    with patch("requests.get", return_value=mock_response):
        result = provider.get_kalshi_consensus({"market": "Fed"})
    assert "47.0%" in result
    assert "2 contracts" in result


def test_get_arb_spread_unpaid(provider):
    mock_response = MagicMock()
    mock_response.status_code = 402
    mock_response.json.return_value = {
        "accepts": [{"maxAmountRequired": "20000", "payTo": "0xabc", "network": "eip155:8453"}],
    }
    with patch("requests.get", return_value=mock_response):
        result = provider.get_arb_spread({"markets": "Fed,BTC"})
    assert "Payment required" in result
    assert "20000" in result
