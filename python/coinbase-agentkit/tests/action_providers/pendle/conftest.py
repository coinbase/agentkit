from unittest.mock import MagicMock

import pytest

from coinbase_agentkit.action_providers.pendle.pendle_action_provider import (
    PendleActionProvider,
)
from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers import EvmWalletProvider


@pytest.fixture
def pendle_wallet():
    """Create a mock wallet provider on Base mainnet for testing."""
    mock_wallet = MagicMock(spec=EvmWalletProvider)
    mock_wallet.get_address.return_value = "0x1111111111111111111111111111111111111111"
    mock_wallet.get_network.return_value = Network(
        protocol_family="evm",
        network_id="base-mainnet",
        chain_id="8453",
    )
    return mock_wallet


@pytest.fixture
def pendle_provider():
    """Create a PendleActionProvider instance for testing."""
    return PendleActionProvider()


@pytest.fixture
def pendle_fixtures():
    """Provide common test fixtures."""
    return {
        "market_address": "0x2222222222222222222222222222222222222222",
        "pt_address": "0x5555555555555555555555555555555555555555",
        "yt_address": "0x6666666666666666666666666666666666666666",
        "sy_address": "0x7777777777777777777777777777777777777777",
        "underlying_address": "0x8888888888888888888888888888888888888888",
        "token_in": "0x3333333333333333333333333333333333333333",
        "router_address": "0x888888888889758F76e7103c6CbF23ABbF58F946",
    }


@pytest.fixture
def pendle_market_response(pendle_fixtures):
    """Sample Pendle /markets/{address} response shape."""
    return {
        "address": pendle_fixtures["market_address"],
        "symbol": "PT-USDe-25APR",
        "expiry": "2026-04-25T00:00:00.000Z",
        "pt": {"address": pendle_fixtures["pt_address"], "symbol": "PT-USDe", "decimals": 18},
        "yt": {"address": pendle_fixtures["yt_address"], "symbol": "YT-USDe", "decimals": 18},
        "sy": {"address": pendle_fixtures["sy_address"], "symbol": "SY-USDe", "decimals": 18},
        "underlyingAsset": {
            "address": pendle_fixtures["underlying_address"],
            "symbol": "USDe",
            "decimals": 18,
        },
    }


@pytest.fixture
def pendle_convert_response(pendle_fixtures):
    """Sample Pendle /convert response shape."""
    return {
        "action": "swap",
        "requiredApprovals": [
            {"token": pendle_fixtures["token_in"], "amount": "100000000"},
        ],
        "routes": [
            {
                "contractParamInfo": {"method": "swapExactTokenForPt"},
                "tx": {
                    "to": pendle_fixtures["router_address"],
                    "data": "0xc81f847a00000000",
                    "value": "0",
                    "from": "0x1111111111111111111111111111111111111111",
                },
            }
        ],
    }
