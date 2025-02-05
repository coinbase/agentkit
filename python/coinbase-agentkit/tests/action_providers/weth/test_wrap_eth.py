from unittest.mock import Mock, patch
import pytest
from web3 import Web3

from coinbase_agentkit.action_providers.weth.weth_action_provider import (
    WETH_ADDRESS,
    WETH_ABI,
    MIN_WRAP_AMOUNT,
    SUPPORTED_NETWORKS,
    WethActionProvider,
    WrapEthSchema,
)
from coinbase_agentkit.wallet_providers import EvmWalletProvider
from coinbase_agentkit.network import Network

# Test constants
MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
MOCK_AMOUNT = str(MIN_WRAP_AMOUNT)
MOCK_TX_HASH = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

MOCK_NETWORK = Network(
    protocol_family="evm",
    chain_id=1,
    network_id="base-sepolia"
)

@pytest.fixture
def mock_wallet_provider():
    """Create a mock wallet provider for testing."""
    mock = Mock(spec=EvmWalletProvider)
    mock.get_address.return_value = MOCK_ADDRESS
    mock.get_network.return_value = MOCK_NETWORK
    mock.send_transaction.return_value = MOCK_TX_HASH
    return mock

@pytest.fixture
def weth_action_provider(mock_wallet_provider):
    """Create a WethActionProvider instance with a mock wallet provider."""
    provider = WethActionProvider()
    provider.wallet_provider = mock_wallet_provider
    return provider

def test_wrap_eth_schema_valid():
    """Test that WrapEthSchema accepts valid parameters."""
    schema = WrapEthSchema(amount_to_wrap=MOCK_AMOUNT)
    assert isinstance(schema, WrapEthSchema)
    assert schema.amount_to_wrap == MOCK_AMOUNT

def test_wrap_eth_schema_invalid_format():
    """Test that WrapEthSchema rejects invalid format inputs."""
    invalid_inputs = [
        "",
        "-123",
        "abc",
        "123.456",
        "123abc",
    ]
    for invalid_input in invalid_inputs:
        with pytest.raises(ValueError, match="Amount must be a whole number as a string"):
            WrapEthSchema(amount_to_wrap=invalid_input)

def test_wrap_eth_schema_below_minimum():
    """Test that WrapEthSchema rejects amounts below minimum."""
    below_min = str(MIN_WRAP_AMOUNT - 1)
    with pytest.raises(ValueError, match=f"Amount must be at least {MIN_WRAP_AMOUNT} wei"):
        WrapEthSchema(amount_to_wrap=below_min)

def test_wrap_eth_schema_missing_fields():
    """Test that WrapEthSchema rejects missing fields."""
    with pytest.raises(ValueError):
        WrapEthSchema()

def test_wrap_eth_success(weth_action_provider, mock_wallet_provider):
    """Test successful ETH wrapping."""
    # Create actual Web3 contract to get the real encoded data
    w3 = Web3()
    contract = w3.eth.contract(address=WETH_ADDRESS, abi=WETH_ABI)
    data = contract.encode_abi("deposit", args=[])

    result = weth_action_provider.wrap_eth(mock_wallet_provider, {"amount_to_wrap": MOCK_AMOUNT})

    mock_wallet_provider.send_transaction.assert_called_once_with({
        "to": WETH_ADDRESS,
        "data": data,
        "value": MOCK_AMOUNT
    })
    mock_wallet_provider.wait_for_transaction_receipt.assert_called_once_with(MOCK_TX_HASH)

    assert result == f"Wrapped ETH with transaction hash: {MOCK_TX_HASH}"

def test_wrap_eth_failure(weth_action_provider, mock_wallet_provider):
    """Test error handling in ETH wrapping."""
    error_message = "Failed to wrap ETH"
    mock_wallet_provider.send_transaction.side_effect = Exception(error_message)

    result = weth_action_provider.wrap_eth(mock_wallet_provider, {"amount_to_wrap": MOCK_AMOUNT})
    assert result == f"Error wrapping ETH: {error_message}"

def test_supports_network(weth_action_provider):
    """Test network support validation."""
    test_cases = [
        # network_id, chain_id, protocol_family, expected_result
        ("base-mainnet", 1, "evm", True),
        ("base-sepolia", 1, "evm", True),
        ("ethereum-mainnet", 1, "evm", False),
        ("arbitrum-one", 42161, "evm", False),
        ("optimism", 10, "evm", False),
        ("base-goerli", 84531, "evm", False),
        ("mainnet", None, "bitcoin", False),
        ("mainnet", None, "solana", False),
    ]

    for network_id, chain_id, protocol_family, expected_result in test_cases:
        network = Network(
            protocol_family=protocol_family,
            chain_id=chain_id,
            network_id=network_id
        )
        result = weth_action_provider.supports_network(network)
        assert result is expected_result, \
            f"Network {network_id} should{' ' if expected_result else ' not '}be supported"

def test_action_provider_setup():
    """Test action provider initialization."""
    provider = WethActionProvider()
    assert provider.name == "weth"
    assert provider.action_providers == []
