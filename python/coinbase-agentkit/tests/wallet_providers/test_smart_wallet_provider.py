"""Tests for the Smart Wallet Provider."""

from decimal import Decimal
from unittest.mock import ANY, Mock, patch

import pytest
from cdp import EncodedCall, SmartWallet, UserOperation
from eth_account.account import LocalAccount

from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers.smart_wallet_provider import (
    SmartWalletProvider,
    SmartWalletProviderConfig,
)

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

    mock.use_network.return_value = mock

    user_operation = Mock(spec=UserOperation)
    result = Mock()
    result.status = UserOperation.Status.COMPLETE
    result.transaction_hash = MOCK_TRANSACTION_HASH
    user_operation.wait.return_value = result
    mock.send_user_operation.return_value = user_operation

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
    
    # Create the actual dictionary to patch
    network_dict = {MOCK_NETWORK_ID: mock_chain}
    
    with patch(
        "coinbase_agentkit.wallet_providers.smart_wallet_provider.NETWORK_ID_TO_CHAIN",
        network_dict
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


class TestSmartWalletProvider:
    """Test suite for SmartWalletProvider."""

    def test_init_with_api_keys(self, mock_cdp, mock_signer, mock_smart_wallet):
        """Test initialization with API keys."""
        with (
            patch(
                "coinbase_agentkit.wallet_providers.smart_wallet_provider.SmartWallet"
            ) as mock_smart_wallet_class,
            patch(
                "coinbase_agentkit.wallet_providers.smart_wallet_provider.NETWORK_ID_TO_CHAIN", 
                {MOCK_NETWORK_ID: Mock(id=MOCK_CHAIN_ID, rpc_urls={"default": Mock(http=[MOCK_RPC_URL])})}
            )
        ):
            mock_smart_wallet_class.create.return_value = mock_smart_wallet

            config = SmartWalletProviderConfig(
                network_id=MOCK_NETWORK_ID,
                signer=mock_signer,
                cdp_api_key_name=MOCK_API_KEY_NAME,
                cdp_api_key_private_key=MOCK_API_KEY_PRIVATE_KEY,
            )

            provider = SmartWalletProvider(config)

            mock_cdp.configure.assert_called_once_with(
                api_key_name=MOCK_API_KEY_NAME,
                private_key=MOCK_API_KEY_PRIVATE_KEY,
                source="agentkit",
                source_version=ANY,
            )

            mock_smart_wallet_class.create.assert_called_once_with(mock_signer)
            assert mock_smart_wallet.use_network.call_args is not None
            call_args = mock_smart_wallet.use_network.call_args[1]
            assert call_args.get('paymaster_url') is None
            assert call_args.get('chain_id') == int(MOCK_CHAIN_ID)
            assert provider.get_address() == MOCK_ADDRESS

    def test_init_without_api_keys(self, mock_cdp, mock_signer, mock_smart_wallet):
        """Test initialization without API keys."""
        with (
            patch(
                "coinbase_agentkit.wallet_providers.smart_wallet_provider.SmartWallet"
            ) as mock_smart_wallet_class,
            patch(
                "coinbase_agentkit.wallet_providers.smart_wallet_provider.NETWORK_ID_TO_CHAIN",
                {MOCK_NETWORK_ID: Mock(id=MOCK_CHAIN_ID, rpc_urls={"default": Mock(http=[MOCK_RPC_URL])})}
            )
        ):
            mock_smart_wallet_class.create.return_value = mock_smart_wallet

            config = SmartWalletProviderConfig(network_id=MOCK_NETWORK_ID, signer=mock_signer)

            provider = SmartWalletProvider(config)

            mock_cdp.configure_from_json.assert_called_once()
            mock_smart_wallet_class.create.assert_called_once_with(mock_signer)
            assert provider.get_address() == MOCK_ADDRESS

    def test_init_with_existing_wallet(self, mock_cdp, mock_signer, mock_smart_wallet):
        """Test initialization with existing smart wallet address."""
        with (
            patch(
                "coinbase_agentkit.wallet_providers.smart_wallet_provider.to_smart_wallet"
            ) as mock_to_smart_wallet,
            patch(
                "coinbase_agentkit.wallet_providers.smart_wallet_provider.NETWORK_ID_TO_CHAIN",
                {MOCK_NETWORK_ID: Mock(id=MOCK_CHAIN_ID, rpc_urls={"default": Mock(http=[MOCK_RPC_URL])})}
            )
        ):
            mock_to_smart_wallet.return_value = mock_smart_wallet

            config = SmartWalletProviderConfig(
                network_id=MOCK_NETWORK_ID, signer=mock_signer, smart_wallet_address=MOCK_ADDRESS
            )

            provider = SmartWalletProvider(config)

            mock_to_smart_wallet.assert_called_once_with(
                signer=mock_signer, smart_wallet_address=MOCK_ADDRESS
            )
            assert provider.get_address() == MOCK_ADDRESS

    def test_get_address(self, wallet_provider):
        """Test get_address method."""
        assert wallet_provider.get_address() == MOCK_ADDRESS

    def test_get_network(self, wallet_provider):
        """Test get_network method."""
        network = wallet_provider.get_network()
        assert isinstance(network, Network)
        assert network.protocol_family == "evm"
        assert network.network_id == MOCK_NETWORK_ID
        assert network.chain_id == MOCK_CHAIN_ID

    def test_get_name(self, wallet_provider):
        """Test get_name method."""
        assert wallet_provider.get_name() == "cdp_smart_wallet_provider"

    def test_sign_message(self, wallet_provider):
        """Test sign_message method raises NotImplementedError."""
        with pytest.raises(
            NotImplementedError, match="Smart wallets do not support signing raw messages"
        ):
            wallet_provider.sign_message("Hello, world!")

    def test_sign_typed_data(self, wallet_provider):
        """Test sign_typed_data method raises NotImplementedError."""
        with pytest.raises(
            NotImplementedError, match="Smart wallets do not support signing typed data"
        ):
            wallet_provider.sign_typed_data({})

    def test_sign_transaction(self, wallet_provider):
        """Test sign_transaction method raises NotImplementedError."""
        with pytest.raises(
            NotImplementedError, match="Smart wallets do not support signing transactions"
        ):
            wallet_provider.sign_transaction({})

    def test_send_transaction(self, wallet_provider, mock_smart_wallet):
        """Test send_transaction method."""
        transaction = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI, "data": "0x"}

        tx_hash = wallet_provider.send_transaction(transaction)

        assert tx_hash == MOCK_TRANSACTION_HASH
        mock_smart_wallet.send_user_operation.assert_called_once()

        call_args = mock_smart_wallet.send_user_operation.call_args[1]["calls"][0]
        assert call_args.to == transaction["to"]
        assert call_args.value == transaction["value"]
        assert call_args.data == transaction["data"]

    def test_send_user_operation_success(self, wallet_provider, mock_smart_wallet):
        """Test send_user_operation method success case."""
        calls = [EncodedCall(to="0x1234", value=MOCK_ONE_ETH_WEI, data="0x")]

        tx_hash = wallet_provider.send_user_operation(calls)

        assert tx_hash == MOCK_TRANSACTION_HASH
        mock_smart_wallet.send_user_operation.assert_called_once_with(calls=calls)

    def test_send_user_operation_failure(self, wallet_provider, mock_smart_wallet):
        """Test send_user_operation method failure case."""
        user_operation = Mock(spec=UserOperation)
        result = Mock()
        result.status = UserOperation.Status.FAILED
        user_operation.wait.return_value = result
        mock_smart_wallet.send_user_operation.return_value = user_operation

        calls = [EncodedCall(to="0x1234", value=MOCK_ONE_ETH_WEI, data="0x")]

        with pytest.raises(Exception, match="Operation failed with status"):
            wallet_provider.send_user_operation(calls)

    def test_wait_for_transaction_receipt(self, wallet_provider, mock_web3):
        """Test wait_for_transaction_receipt method."""
        tx_hash = "0x1234567890123456789012345678901234567890123456789012345678901234"

        receipt = wallet_provider.wait_for_transaction_receipt(tx_hash)

        assert receipt == {"transactionHash": bytes.fromhex(MOCK_TRANSACTION_HASH[2:])}
        mock_web3.return_value.eth.wait_for_transaction_receipt.assert_called_once_with(
            tx_hash, timeout=120, poll_latency=0.1
        )

    def test_read_contract(self, wallet_provider, mock_web3):
        """Test read_contract method."""
        contract_address = MOCK_ADDRESS_TO
        abi = [
            {
                "name": "testFunction",
                "type": "function",
                "inputs": [],
                "outputs": [{"type": "string"}],
            }
        ]

        result = wallet_provider.read_contract(contract_address, abi, "testFunction", ["arg1"])

        assert result == "mock_result"
        mock_web3.return_value.eth.contract.assert_called_once_with(
            address=contract_address, abi=abi
        )

    def test_get_balance(self, wallet_provider, mock_web3):
        """Test get_balance method."""
        balance = wallet_provider.get_balance()

        assert balance == Decimal(str(MOCK_ONE_ETH_WEI))
        mock_web3.return_value.eth.get_balance.assert_called_once_with(MOCK_ADDRESS)

    def test_native_transfer(self, wallet_provider, mock_smart_wallet, mock_web3):
        """Test native_transfer method."""
        to_address = MOCK_ADDRESS_TO
        amount = Decimal("1.0")

        mock_web3.to_wei.return_value = MOCK_ONE_ETH_WEI

        tx_hash = wallet_provider.native_transfer(to_address, amount)

        assert tx_hash == MOCK_TRANSACTION_HASH
        mock_web3.to_wei.assert_called_once_with(amount, "ether")
        mock_smart_wallet.send_user_operation.assert_called_once()

        call_args = mock_smart_wallet.send_user_operation.call_args[1]["calls"][0]
        assert call_args.to == to_address
        assert call_args.value == MOCK_ONE_ETH_WEI
        assert call_args.data == "0x"

    def test_native_transfer_failure(self, wallet_provider, mock_smart_wallet):
        """Test native_transfer method failure case."""
        user_operation = Mock(spec=UserOperation)
        result = Mock()
        result.status = UserOperation.Status.FAILED
        user_operation.wait.return_value = result
        mock_smart_wallet.send_user_operation.return_value = user_operation

        with pytest.raises(Exception, match="Transaction failed"):
            wallet_provider.native_transfer("0x1234", Decimal("1.0"))
