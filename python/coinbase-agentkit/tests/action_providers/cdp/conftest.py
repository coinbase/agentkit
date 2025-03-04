"""Test fixtures for CDP API tests."""

from unittest.mock import Mock, patch

import pytest

from coinbase_agentkit.network import Network

MOCK_API_KEY_NAME = "mock-api-key"
MOCK_API_KEY_PRIVATE_KEY = "mock-private-key"

MOCK_MAINNET_NETWORK_ID = "base-mainnet"
MOCK_MAINNET_CHAIN_ID = "8453"
MOCK_TESTNET_NETWORK_ID = "base-sepolia"
MOCK_TESTNET_CHAIN_ID = "84532"

MOCK_EXPLORER_URL = "https://sepolia.basescan.org/tx"
MOCK_TX_HASH = "0xa84bf2ef03503a11a41c12e2f357fb77ab7e16dd79bf48837a6d555ac44e9112"
MOCK_WALLET_ADDRESS = "0xe6b2af36b3bb8d47206a129ff11d5a2de2a63c83"
MOCK_CONTRACT_ADDRESS = "0x123456789abcdef"

MOCK_NFT_BASE_URI = "https://www.test.xyz/metadata/"
MOCK_NFT_NAME = "Test Token"
MOCK_NFT_SYMBOL = "TEST"
MOCK_CONTRACT_NAME = "Test Contract"
MOCK_SOLIDITY_VERSION = "0.8.0"
MOCK_SOLIDITY_INPUT_JSON = "{}"
MOCK_CONSTRUCTOR_ARGS = {"arg1": "value1", "arg2": "value2"}
MOCK_TOKEN_SUPPLY = "1000000000000000000"

MOCK_VALUE = "3000"
MOCK_TO_AMOUNT = "1"
MOCK_FROM_ASSET_ID = "usdc"
MOCK_TO_ASSET_ID = "weth"
MOCK_MAINNET_TX_HASH = "0xffcc5fb66fd40f25af7a412025043096577d8c1e00f5fa2c95861a1ba6832a37"
MOCK_MAINNET_TX_LINK = (
    "https://basescan.org/tx/0xffcc5fb66fd40f25af7a412025043096577d8c1e00f5fa2c95861a1ba6832a37"
)


@pytest.fixture
def mock_contract():
    """Create a mock contract for testing."""
    contract = Mock()
    contract.contract_address = MOCK_CONTRACT_ADDRESS
    contract.transaction = Mock(
        transaction_link=f"{MOCK_EXPLORER_URL}/{MOCK_TX_HASH}", transaction_hash=MOCK_TX_HASH
    )
    contract.wait.return_value = contract
    return contract


@pytest.fixture
def mock_contract_result():
    """Create a mock contract deployment result."""
    result = Mock()
    result.contract_address = MOCK_CONTRACT_ADDRESS

    transaction = Mock()
    transaction.transaction_hash = MOCK_TX_HASH
    transaction.transaction_link = f"{MOCK_EXPLORER_URL}/{MOCK_TX_HASH}"

    result.transaction = transaction

    return result


@pytest.fixture
def mock_env(monkeypatch):
    """Mock environment variables for testing."""
    monkeypatch.setenv("CDP_API_KEY_NAME", MOCK_API_KEY_NAME)
    monkeypatch.setenv("CDP_API_KEY_PRIVATE_KEY", MOCK_API_KEY_PRIVATE_KEY)


@pytest.fixture
def mock_transaction():
    """Create a mock transaction for testing."""
    mock_tx = Mock()
    mock_tx.transaction_link = f"{MOCK_EXPLORER_URL}/{MOCK_TX_HASH}"
    mock_tx.wait.return_value = mock_tx
    return mock_tx


@pytest.fixture
def mock_wallet():
    """Create a mock wallet."""
    wallet = Mock()
    wallet.network_id = MOCK_TESTNET_NETWORK_ID
    wallet.get_address.return_value = MOCK_WALLET_ADDRESS
    return wallet


@pytest.fixture
def mock_wallet_provider():
    """Create a mock mainnet wallet for testing."""
    wallet = Mock()
    wallet.get_network.return_value = Network(
        protocol_family="evm",
        network_id=MOCK_MAINNET_NETWORK_ID,
        chain_id=MOCK_MAINNET_CHAIN_ID,
    )
    wallet.get_address.return_value = MOCK_WALLET_ADDRESS
    return wallet


@pytest.fixture
def mock_wallet_testnet_provider():
    """Create a mock testnet wallet for testing."""
    wallet = Mock()
    wallet.get_network.return_value = Network(
        protocol_family="evm",
        network_id=MOCK_TESTNET_NETWORK_ID,
        chain_id=MOCK_TESTNET_CHAIN_ID,
    )
    wallet.get_address.return_value = MOCK_WALLET_ADDRESS
    return wallet


@pytest.fixture(autouse=True)
def mock_cdp_imports():
    """Mock CDP SDK imports."""
    with (
        patch("coinbase_agentkit.action_providers.cdp.cdp_api_action_provider.Cdp") as mock_cdp,
        patch(
            "coinbase_agentkit.action_providers.cdp.cdp_api_action_provider.ExternalAddress"
        ) as mock_external_address,
    ):
        yield mock_cdp, mock_external_address
