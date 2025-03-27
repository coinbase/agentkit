"""common test fixtures for smart wallet provider tests."""

from unittest.mock import Mock, patch

import pytest
from cdp import SmartWallet, UserOperation
from eth_account.account import LocalAccount

from coinbase_agentkit.wallet_providers.smart_wallet_provider import (
    SmartWalletProvider,
    SmartWalletProviderConfig,
)

# =========================================================
# test constants
# =========================================================

MOCK_API_KEY_NAME = "test_api_key_name"
MOCK_API_KEY_PRIVATE_KEY = "test_api_key_private_key"

MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
MOCK_NETWORK_ID = "base-sepolia"
MOCK_CHAIN_ID = "84532"
MOCK_PAYMASTER_URL = "https://paymaster.example.com"
MOCK_RPC_URL = "https://sepolia.base.org"

MOCK_TRANSACTION_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
MOCK_ADDRESS_TO = "0x1234567890123456789012345678901234567890"

MOCK_ONE_ETH_WEI = 1000000000000000000

MOCK_TX_HASH = MOCK_TRANSACTION_HASH
MOCK_AMOUNT = MOCK_ONE_ETH_WEI
MOCK_TRANSACTION = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI, "data": "0x"}

# =========================================================
# fixtures
# =========================================================


@pytest.fixture
def mock_cdp():
    """Create a mock for CDP SDK."""
    with patch("coinbase_agentkit.wallet_providers.smart_wallet_provider.Cdp") as mock_cdp:
        yield mock_cdp


@pytest.fixture
def mock_signer():
    """Create a mock LocalAccount for signer."""
    mock = Mock(spec=LocalAccount)
    mock.address = "0x123456789012345678901234567890123456789012"
    return mock


@pytest.fixture
def mock_smart_wallet():
    """Create a mock SmartWallet."""
    mock = Mock(spec=SmartWallet)
    mock.address = MOCK_ADDRESS

    def mock_use_network(**kwargs):
        mock.use_network_kwargs = kwargs
        return mock

    mock.use_network = mock_use_network

    user_operation = Mock(spec=UserOperation)
    result = Mock()
    result.status = UserOperation.Status.COMPLETE
    result.transaction_hash = MOCK_TRANSACTION_HASH
    user_operation.wait.return_value = result
    mock.send_user_operation.return_value = user_operation

    mock_web3 = Mock()
    mock_contract = Mock()
    mock_function = Mock()
    mock_function.call.return_value = "mock_result"
    mock_contract.functions = {"testFunction": lambda *args: mock_function}
    mock_web3.eth.contract.return_value = mock_contract

    type(mock).web3 = property(lambda x: mock_web3)

    return mock


@pytest.fixture
def mock_web3():
    """Create a mock Web3 instance."""
    with patch("coinbase_agentkit.wallet_providers.smart_wallet_provider.Web3") as mock_web3:
        mock_web3_instance = Mock()
        mock_web3.return_value = mock_web3_instance

        mock_web3_instance.eth.get_balance.return_value = MOCK_ONE_ETH_WEI

        mock_receipt = {"transactionHash": bytes.fromhex(MOCK_TRANSACTION_HASH[2:])}
        mock_web3_instance.eth.wait_for_transaction_receipt.return_value = mock_receipt

        mock_contract = Mock()
        mock_function = Mock()
        mock_function.call.return_value = "mock_result"
        mock_contract.functions = {"testFunction": lambda *args: mock_function}
        mock_web3_instance.eth.contract.return_value = mock_contract

        mock_web3.to_wei.return_value = MOCK_ONE_ETH_WEI

        yield mock_web3


@pytest.fixture
def mock_network_id_to_chain():
    """Create a mock for NETWORK_ID_TO_CHAIN."""
    mock_chain = Mock()
    mock_chain.id = MOCK_CHAIN_ID
    mock_chain.rpc_urls = {"default": Mock(http=[MOCK_RPC_URL])}

    network_dict = {MOCK_NETWORK_ID: mock_chain}

    with patch(
        "coinbase_agentkit.wallet_providers.smart_wallet_provider.NETWORK_ID_TO_CHAIN", network_dict
    ):
        yield network_dict


@pytest.fixture
def wallet_provider(mock_cdp, mock_signer, mock_smart_wallet, mock_web3, mock_network_id_to_chain):
    """Create a SmartWalletProvider instance with mocked dependencies."""
    with (
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.SmartWallet"
        ) as mock_smart_wallet_class,
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.to_smart_wallet"
        ) as mock_to_smart_wallet,
    ):
        mock_smart_wallet_class.create.return_value = mock_smart_wallet
        mock_to_smart_wallet.return_value = mock_smart_wallet

        config = SmartWalletProviderConfig(
            network_id=MOCK_NETWORK_ID,
            signer=mock_signer,
            cdp_api_key_name=MOCK_API_KEY_NAME,
            cdp_api_key_private_key=MOCK_API_KEY_PRIVATE_KEY,
            paymaster_url=MOCK_PAYMASTER_URL,
        )

        provider = SmartWalletProvider(config)

        yield provider
