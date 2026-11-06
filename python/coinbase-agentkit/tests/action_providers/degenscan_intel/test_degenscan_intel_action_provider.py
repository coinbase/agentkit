"""Tests for Degenscan Intel action provider."""

from unittest.mock import MagicMock

from coinbase_agentkit.action_providers.degenscan_intel.degenscan_intel_action_provider import (
    DegenscanIntelActionProvider,
    degenscan_intel_action_provider,
)


def _session(status=200, text='{"ok":true}'):
    s = MagicMock()
    r = MagicMock()
    r.status_code = status
    r.text = text
    s.get.return_value = r
    return s


def test_free_trial_header_and_url():
    """Free trial header is sent when no key is set."""
    s = _session()
    p = DegenscanIntelActionProvider(session=s, api_key=None)
    assert p.get_market_pulse({}) == '{"ok":true}'
    url, kw = s.get.call_args[0][0], s.get.call_args[1]
    assert url == "https://intel.degenscan.io/v1/pulse"
    assert kw["headers"]["x-free-trial"] == "1"


def test_events_query_and_api_key():
    """Events query params and API key header."""
    s = _session()
    p = DegenscanIntelActionProvider(session=s, api_key="k_test")
    p.get_market_events(
        {"since": "4h", "universe": ["BTC", "NVDA"], "min_confidence": 0.5, "limit": 10}
    )
    kw = s.get.call_args[1]
    assert kw["params"] == {
        "since": "4h",
        "universe": "BTC,NVDA",
        "min_confidence": 0.5,
        "limit": 10,
    }
    assert kw["headers"]["x-api-key"] == "k_test"


def test_uppercase_paths():
    """Asset ids are uppercased in the path."""
    s = _session()
    p = DegenscanIntelActionProvider(session=s)
    p.get_asset_brief({"asset_id": "btc"})
    assert s.get.call_args[0][0] == "https://intel.degenscan.io/v1/brief/BTC"
    p.get_perp_derivs({"symbol": "eth"})
    assert s.get.call_args[0][0] == "https://intel.degenscan.io/v1/derivs/ETH"


def test_deribit_perps_params():
    """Deribit perps route joins symbols."""
    s = _session()
    p = DegenscanIntelActionProvider(session=s)
    p.get_deribit_perps({"symbols": ["BTC", "SOL"], "sort": "gap", "limit": 10})
    assert s.get.call_args[0][0] == "https://intel.degenscan.io/v1/deribit/perps"
    assert s.get.call_args[1]["params"] == {"symbols": "BTC,SOL", "sort": "gap", "limit": 10}


def test_402_message():
    """A 402 returns a readable payment message."""
    p = DegenscanIntelActionProvider(session=_session(402, "{}"))
    assert "Payment required" in p.get_market_pulse({})


def test_supports_all_networks():
    """Provider supports every network."""
    assert degenscan_intel_action_provider().supports_network(MagicMock()) is True
