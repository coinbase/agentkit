"""common test fixtures for CDP EVM smart wallet provider tests."""

from unittest.mock import AsyncMock, Mock, patch

import pytest
from eth_account.account import Account

from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers.cdp_evm_smart_wallet_provider import (
    CdpEvmSmartWalletProvider,
    CdpEvmSmartWalletProviderConfig,
)

# =========================================================
# test constants
# =========================================================

MOCK_API_KEY_ID = "test_api_key_id"
MOCK_API_KEY_SECRET = "test_api_key_secret"
MOCK_WALLET_SECRET = "test_wallet_secret"

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
def mock_cdp_client():
    """Create a mock for CDP client."""
    with patch(
        "coinbase_agentkit.wallet_providers.cdp_evm_smart_wallet_provider.CdpClient"
    ) as mock_cdp_client:
        mock_instance = Mock()
        mock_cdp_client.return_value = mock_instance
        mock_instance.__aenter__ = AsyncMock(return_value=mock_instance)
        mock_instance.__aexit__ = AsyncMock(return_value=None)
        mock_instance.close = AsyncMock()
        mock_instance.evm = Mock()
        mock_instance.evm.get_account = AsyncMock()
        mock_instance.evm.get_smart_account = AsyncMock()
        mock_instance.evm.create_smart_account = AsyncMock()
        mock_instance.evm.send_user_operation = AsyncMock()
        mock_instance.evm.wait_for_user_operation = AsyncMock()

        # Create a mock user operation result
        user_op_result = Mock()
        user_op_result.transaction_hash = MOCK_TRANSACTION_HASH
        mock_instance.evm.wait_for_user_operation.return_value = user_op_result

        yield mock_instance


@pytest.fixture
def mock_owner():
    """Create a mock owner."""
    mock = Mock(spec=Account)
    mock.address = "0x123456789012345678901234567890123456789012"
    return mock


@pytest.fixture
def mock_smart_account():
    """Create a mock smart account."""
    mock = Mock()
    mock.address = MOCK_ADDRESS
    return mock


@pytest.fixture
def mock_web3():
    """Create a mock Web3 instance."""
    with patch(
        "coinbase_agentkit.wallet_providers.cdp_evm_smart_wallet_provider.Web3"
    ) as mock_web3:
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
        mock_web3.to_checksum_address = lambda addr: addr

        yield mock_web3


@pytest.fixture
def mock_asyncio():
    """Create a mock for asyncio."""
    with patch(
        "coinbase_agentkit.wallet_providers.cdp_evm_smart_wallet_provider.asyncio"
    ) as mock_asyncio:
        # Create a side effect for asyncio.run that handles the initialization coroutine
        def run_side_effect(coro):
            # Special handling for the initialization_accounts coroutine
            if coro.__name__ == "initialize_accounts":
                # Return a tuple of mock owner and smart account
                mock_owner = Mock(spec=Account)
                mock_owner.address = "0x123456789012345678901234567890123456789012"

                mock_smart_account = Mock()
                mock_smart_account.address = MOCK_ADDRESS

                return (mock_owner, mock_smart_account)
            # For client.close, just return None
            return None

        mock_asyncio.run = Mock(side_effect=run_side_effect)
        yield mock_asyncio


@pytest.fixture
def mock_network_id_to_chain():
    """Create a mock for NETWORK_ID_TO_CHAIN."""
    mock_chain = Mock()
    mock_chain.id = MOCK_CHAIN_ID
    mock_chain.rpc_urls = {"default": Mock(http=[MOCK_RPC_URL])}

    network_dict = {MOCK_NETWORK_ID: mock_chain}

    with patch(
        "coinbase_agentkit.wallet_providers.cdp_evm_smart_wallet_provider.NETWORK_ID_TO_CHAIN",
        network_dict,
    ):
        yield network_dict


@pytest.fixture
def mocked_wallet_provider(
    mock_cdp_client,
    mock_owner,
    mock_smart_account,
    mock_web3,
    mock_asyncio,
    mock_network_id_to_chain,
):
    """Create a CdpEvmSmartWalletProvider instance with mocked dependencies."""

    # Mock the async functions to return synchronously
    async def get_account_mock(*args, **kwargs):
        return mock_owner

    async def get_smart_account_mock(*args, **kwargs):
        return mock_smart_account

    mock_cdp_client.evm.get_account.side_effect = get_account_mock
    mock_cdp_client.evm.get_smart_account.side_effect = get_smart_account_mock

    # Setup the configuration
    config = CdpEvmSmartWalletProviderConfig(
        network_id=MOCK_NETWORK_ID,
        api_key_id=MOCK_API_KEY_ID,
        api_key_secret=MOCK_API_KEY_SECRET,
        wallet_secret=MOCK_WALLET_SECRET,
        owner=mock_owner.address,
        address=MOCK_ADDRESS,
        paymaster_url=MOCK_PAYMASTER_URL,
    )

    # Patch the initialization to avoid async calls
    with patch.object(CdpEvmSmartWalletProvider, "__init__", return_value=None):
        provider = CdpEvmSmartWalletProvider(config)
        provider._api_key_id = MOCK_API_KEY_ID
        provider._api_key_secret = MOCK_API_KEY_SECRET
        provider._wallet_secret = MOCK_WALLET_SECRET
        provider._account = mock_smart_account
        provider._address = MOCK_ADDRESS

        # Create a proper Network instance instead of a mock
        provider._network = Network(
            protocol_family="evm",
            network_id=MOCK_NETWORK_ID,
            chain_id=MOCK_CHAIN_ID,
        )

        provider._web3 = mock_web3.return_value
        provider._owner = mock_owner
        provider._gas_limit_multiplier = 1.2
        provider._fee_per_gas_multiplier = 1
        provider.get_client = Mock(return_value=mock_cdp_client)

        # Update _run_async to properly handle coroutines
        async def mock_coro_func():
            # This is a dummy async function that returns a mock with a transaction_hash
            mock_result = Mock()
            mock_result.transaction_hash = MOCK_TRANSACTION_HASH
            return mock_result

        def run_async_side_effect(coro):
            # If the coroutine is one related to user operations, return a mock with transaction_hash
            if hasattr(coro, "__name__") and coro.__name__ == "_send_user_operation":
                # For transaction failure tests
                if isinstance(mock_cdp_client.evm.send_user_operation.side_effect, Exception) or (
                    callable(mock_cdp_client.evm.send_user_operation.side_effect)
                    and not isinstance(
                        mock_cdp_client.evm.send_user_operation.side_effect, AsyncMock
                    )
                ):
                    # Use the side_effect function/exception directly
                    if callable(mock_cdp_client.evm.send_user_operation.side_effect):
                        try:
                            # Call the side effect function
                            mock_cdp_client.evm.send_user_operation.side_effect()
                        except Exception as e:
                            raise e
                    else:
                        # It's an exception instance
                        raise mock_cdp_client.evm.send_user_operation.side_effect

                # For wait_for_user_operation timeout tests
                if isinstance(
                    mock_cdp_client.evm.wait_for_user_operation.side_effect, Exception
                ) or (
                    callable(mock_cdp_client.evm.wait_for_user_operation.side_effect)
                    and not isinstance(
                        mock_cdp_client.evm.wait_for_user_operation.side_effect, AsyncMock
                    )
                ):
                    # Use the side_effect function/exception directly
                    if callable(
                        mock_cdp_client.evm.wait_for_user_operation.side_effect
                    ) and not isinstance(
                        mock_cdp_client.evm.wait_for_user_operation.side_effect, type
                    ):
                        try:
                            # Call the side effect function
                            mock_cdp_client.evm.wait_for_user_operation.side_effect()
                        except Exception as e:
                            raise e
                    else:
                        # It's an exception instance or class
                        if isinstance(
                            mock_cdp_client.evm.wait_for_user_operation.side_effect, type
                        ):
                            raise mock_cdp_client.evm.wait_for_user_operation.side_effect(
                                "Transaction timed out"
                            )
                        else:
                            raise mock_cdp_client.evm.wait_for_user_operation.side_effect

                # Return a mock with transaction_hash property for successful cases
                mock_result = Mock()
                mock_result.transaction_hash = MOCK_TRANSACTION_HASH
                return mock_result
            # For client.close, just return None
            return None

        provider._run_async = Mock(side_effect=run_async_side_effect)
        provider._paymaster_url = MOCK_PAYMASTER_URL

        yield provider
