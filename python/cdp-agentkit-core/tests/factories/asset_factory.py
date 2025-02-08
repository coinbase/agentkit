from unittest.mock import Mock

import pytest
from cdp.asset import Asset


@pytest.fixture
def asset_factory():
    """Create and return a factory for creating Asset fixtures."""

    def _create_asset(network_id="base-sepolia", asset_id="usdc", decimals=6, contract_address="0x0000000000000000000000000000000000000001"):
        asset_mock = Mock(spec=Asset)
        asset_mock.asset_id = asset_id
        asset_mock.decimals = decimals
        asset_mock.contract_address = contract_address

        return asset_mock

    return _create_asset
