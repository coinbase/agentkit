"""Common test fixtures for CDP Wallet Provider tests."""

from unittest.mock import AsyncMock, Mock, patch

import pytest

from coinbase_agentkit.wallet_providers.cdp_evm_server_wallet_provider import (
    CdpEvmServerWalletProvider,
    CdpEvmServerWalletProviderConfig,
)

# =========================================================
# test constants
# =========================================================

# mock API key constants
MOCK_API_KEY_ID = "test_api_key_id"
MOCK_API_KEY_SECRET = "test_api_key_secret"
MOCK_WALLET_SECRET = "test_wallet_secret"

# mock address and network constants
MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
MOCK_CHAIN_ID = "84532"
MOCK_NETWORK_ID = "base-sepolia"

# mock transaction constants
MOCK_TRANSACTION_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
MOCK_ADDRESS_TO = "0x1234567890123456789012345678901234567890"

# mock gas constants
MOCK_BASE_FEE_PER_GAS = 10000000000
MOCK_GAS_LIMIT = 21000
MOCK_MAX_FEE_PER_GAS = 30000000000
MOCK_PRIORITY_FEE_PER_GAS = 1000000000

# mock ETH values
MOCK_ONE_ETH_WEI = 1000000000000000000

# mock signature constants
MOCK_SIGNATURE = "0x123456"

# =========================================================
# test fixtures
# =========================================================


@pytest.fixture
def mock_cdp_client():
    """Create a mock for CDP Client with proper async handling."""
    with patch(
        "coinbase_agentkit.wallet_providers.cdp_evm_server_wallet_provider.CdpClient", autospec=True
    ) as mock_client_class:
        # Create a properly configured AsyncMock for the client
        mock_instance = AsyncMock()

        # Set required client properties
        mock_instance.api_key_id = MOCK_API_KEY_ID
        mock_instance.api_key_secret = MOCK_API_KEY_SECRET
        mock_instance.wallet_secret = MOCK_WALLET_SECRET

        # Configure async context manager behavior
        mock_instance.__aenter__.return_value = mock_instance
        mock_instance.__aexit__.return_value = None

        # Create EVM sub-mock with its methods
        mock_evm = AsyncMock()
        mock_evm.send_transaction.return_value = MOCK_TRANSACTION_HASH
        mock_evm.sign_message.return_value = MOCK_SIGNATURE
        mock_evm.sign_typed_data.return_value = MOCK_SIGNATURE
        mock_evm.sign_transaction.return_value = MOCK_SIGNATURE
        mock_evm.create_account.return_value = Mock(address=MOCK_ADDRESS)
        mock_evm.get_account.return_value = Mock(address=MOCK_ADDRESS)

        # Attach EVM mock to client
        mock_instance.evm = mock_evm

        # Make the class constructor return our mock
        mock_client_class.return_value = mock_instance

        yield mock_instance


@pytest.fixture
def mock_account():
    """Create a mock CDP account."""
    mock = Mock()
    mock.address = MOCK_ADDRESS
    return mock


@pytest.fixture
def mock_web3():
    """Create a mock Web3 instance."""
    with patch(
        "coinbase_agentkit.wallet_providers.cdp_evm_server_wallet_provider.Web3"
    ) as mock_web3:
        mock_web3_instance = Mock()
        mock_web3.return_value = mock_web3_instance

        mock_block = {"baseFeePerGas": MOCK_BASE_FEE_PER_GAS}
        mock_web3_instance.eth.get_block.return_value = mock_block
        mock_web3_instance.eth.get_balance.return_value = MOCK_ONE_ETH_WEI

        mock_web3_instance.eth.estimate_gas.return_value = MOCK_GAS_LIMIT

        mock_receipt = {"transactionHash": bytes.fromhex(MOCK_TRANSACTION_HASH[2:])}
        mock_web3_instance.eth.wait_for_transaction_receipt.return_value = mock_receipt

        mock_contract = Mock()
        mock_function = Mock()
        mock_function.call.return_value = "mock_result"
        mock_contract.functions = {"testFunction": lambda *args: mock_function}
        mock_web3_instance.eth.contract.return_value = mock_contract

        mock_web3.to_wei.return_value = MOCK_ONE_ETH_WEI
        mock_web3.to_checksum_address.return_value = MOCK_ADDRESS

        yield mock_web3


@pytest.fixture
def mock_wallet():
    """Create a mock wallet."""
    mock = Mock()
    mock.balance.return_value = 2.0
    return mock


@pytest.fixture
def mocked_wallet_provider(mock_cdp_client, mock_account, mock_web3, mock_wallet):
    """Create a mocked wallet provider instance."""
    # Create the configuration
    config = CdpEvmServerWalletProviderConfig(
        api_key_id=MOCK_API_KEY_ID,
        api_key_secret=MOCK_API_KEY_SECRET,
        wallet_secret=MOCK_WALLET_SECRET,
        network_id=MOCK_NETWORK_ID,
    )

    # Patch the async run to return the mock account directly
    with patch("asyncio.run", return_value=mock_account):
        provider = CdpEvmServerWalletProvider(config)

        # Manually set account and wallet attributes
        provider._account = mock_account
        provider._wallet = mock_wallet

        yield provider
