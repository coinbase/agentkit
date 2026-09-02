import json
from unittest.mock import patch

from coinbase_agentkit.action_providers.defillama.defillama_action_provider import (
    defillama_action_provider,
)


def test_defillama_find_protocol_success():
    """Test searching protocols successfully."""
    mock_protocols = [
        {"id": "uniswap", "name": "Uniswap", "tvl": 5000000000, "chain": "Ethereum"},
        {"id": "aave", "name": "Aave", "tvl": 10000000000, "chain": "Multi-Chain"},
    ]

    with patch("requests.get") as mock_get:
        mock_get.return_value.ok = True
        mock_get.return_value.json.return_value = mock_protocols

        provider = defillama_action_provider()
        res = provider.find_protocol({"query": "uni"})
        parsed = json.loads(res)
        assert len(parsed) == 1
        assert parsed[0]["name"] == "Uniswap"
        mock_get.assert_called_once_with("https://api.llama.fi/protocols", timeout=15)


def test_defillama_find_protocol_not_found():
    """Test searching protocols with no match."""
    with patch("requests.get") as mock_get:
        mock_get.return_value.ok = True
        mock_get.return_value.json.return_value = []

        provider = defillama_action_provider()
        res = provider.find_protocol({"query": "nonexistent"})
        assert 'No protocols found matching "nonexistent"' in res


def test_defillama_get_protocol_success():
    """Test fetching detailed protocol information and pruning time-series."""
    mock_data = {
        "id": "aerodrome",
        "name": "Aerodrome",
        "tvl": [{"date": i, "totalLiquidityUSD": i * 100} for i in range(20)],
    }

    with patch("requests.get") as mock_get:
        mock_get.return_value.ok = True
        mock_get.return_value.json.return_value = mock_data

        provider = defillama_action_provider()
        res = provider.get_protocol({"protocol_id": "aerodrome"})
        parsed = json.loads(res)
        assert parsed["name"] == "Aerodrome"
        assert len(parsed["tvl"]) == 5
        assert parsed["tvl"][0]["date"] == 19


def test_defillama_get_token_prices_success():
    """Test fetching multichain token prices."""
    mock_prices = {
        "coins": {
            "ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": {
                "price": 1.0,
                "symbol": "USDC",
            }
        }
    }

    with patch("requests.get") as mock_get:
        mock_get.return_value.ok = True
        mock_get.return_value.json.return_value = mock_prices

        provider = defillama_action_provider()
        res = provider.get_token_prices(
            {"tokens": ["ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"]}
        )
        parsed = json.loads(res)
        assert "coins" in parsed
        assert (
            parsed["coins"]["ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"]["symbol"]
            == "USDC"
        )


def test_defillama_supports_network():
    """Test network support is universal."""
    provider = defillama_action_provider()
    assert provider.supports_network(None) is True
