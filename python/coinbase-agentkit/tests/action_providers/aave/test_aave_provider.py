from coinbase_agentkit.network import Network


def test_supports_network(aave_provider):
    """Test that the AaveActionProvider correctly identifies supported networks."""
    supported_networks = [
        Network(protocol_family="evm", network_id="base-mainnet", chain_id="8453"),
        Network(protocol_family="evm", network_id="base-sepolia", chain_id="84532"),
    ]
    unsupported_networks = [
        Network(protocol_family="evm", network_id="ethereum-mainnet", chain_id="1"),
        Network(protocol_family="evm", network_id="optimism-mainnet", chain_id="10"),
    ]
    for network in supported_networks:
        assert aave_provider.supports_network(network)
    for network in unsupported_networks:
        assert not aave_provider.supports_network(network)

def test_get_pool_address(aave_provider, aave_fixtures):
    """Test that the _get_pool_address method returns the correct address."""
    network = Network(protocol_family="evm", network_id="base-mainnet", chain_id="8453")
    # Convert both addresses to lowercase for case-insensitive comparison
    assert aave_provider._get_pool_address(network).lower() == aave_fixtures["pool_address"].lower()

def test_get_asset_address(aave_provider, aave_fixtures):
    """Test that the _get_asset_address method returns the correct addresses."""
    network = Network(protocol_family="evm", network_id="base-mainnet", chain_id="8453")
    for asset_id, expected_address in aave_fixtures["asset_addresses"].items():
        assert aave_provider._get_asset_address(network, asset_id) == expected_address

def test_get_asset_address_invalid(aave_provider):
    """Test that the _get_asset_address method raises an exception for invalid assets."""
    network = Network(protocol_family="evm", network_id="base-mainnet", chain_id="8453")
    try:
        aave_provider._get_asset_address(network, "invalid_asset")
        raise AssertionError("Should have raised ValueError")
    except ValueError as e:
        assert "not supported" in str(e).lower()

def test_get_asset_address_invalid_network(aave_provider):
    """Test that the _get_asset_address method raises an exception for invalid networks."""
    network = Network(protocol_family="evm", network_id="ethereum-mainnet", chain_id="1")
    try:
        aave_provider._get_asset_address(network, "weth")
        raise AssertionError("Should have raised an exception")
    except (KeyError, ValueError):
        # Accept either KeyError or ValueError since the implementation might use either
        pass
