"""Tests for the EthAccount Wallet Provider."""

from decimal import Decimal
from unittest.mock import Mock, patch

import pytest
from eth_account.account import LocalAccount
from eth_account.datastructures import SignedTransaction

from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers.eth_account_wallet_provider import (
    EthAccountWalletProvider,
    EthAccountWalletProviderConfig,
)
from coinbase_agentkit.wallet_providers.evm_wallet_provider import EvmGasConfig

MOCK_PRIVATE_KEY = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
MOCK_CHAIN_ID = "84532"
MOCK_NETWORK_ID = "base-sepolia"
MOCK_RPC_URL = "https://sepolia.base.org"

MOCK_TX_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
MOCK_ADDRESS_TO = "0x1234567890123456789012345678901234567890"

MOCK_GAS_LIMIT = 21000
MOCK_GAS_PRICE = 20000000000
MOCK_BASE_FEE_PER_GAS = 10000000000

MOCK_ONE_ETH_WEI = 1000000000000000000
MOCK_BALANCE = Decimal(MOCK_ONE_ETH_WEI)

MOCK_SIGNATURE_BYTES = "123456"
MOCK_SIGNATURE_HEX = f"0x{MOCK_SIGNATURE_BYTES}"

MOCK_BASE_PRIORITY_FEE_GWEI = 0.1
MOCK_FEE_MULTIPLIER = 1.5
MOCK_PRIORITY_FEE_WEI = int(MOCK_ONE_ETH_WEI * MOCK_FEE_MULTIPLIER)


@pytest.fixture
def mock_account():
    """Create a mock LocalAccount."""
    account = Mock(spec=LocalAccount)
    account.address = MOCK_ADDRESS
    account.privateKey = bytes.fromhex(MOCK_PRIVATE_KEY[2:])

    signed_message = Mock()
    signed_message.signature = bytes.fromhex(MOCK_SIGNATURE_BYTES)
    account.sign_message.return_value = signed_message

    signed_typed_data = Mock()
    signed_typed_data.signature = bytes.fromhex(MOCK_SIGNATURE_BYTES)
    account.sign_typed_data.return_value = signed_typed_data

    signed_tx = Mock(spec=SignedTransaction)
    account.sign_transaction.return_value = signed_tx

    return account


@pytest.fixture
def mock_web3():
    """Create a mock Web3 instance."""
    with patch(
        "coinbase_agentkit.wallet_providers.eth_account_wallet_provider.Web3"
    ) as mock_web3_class:
        mock_web3_instance = Mock()
        mock_web3_class.return_value = mock_web3_instance
        mock_web3_class.HTTPProvider.return_value = "http_provider"

        mock_web3_instance.eth.get_balance.return_value = MOCK_BALANCE
        mock_web3_instance.eth.get_transaction_count.return_value = 1

        mock_block = {"baseFeePerGas": MOCK_BASE_FEE_PER_GAS}
        mock_web3_instance.eth.get_block.return_value = mock_block

        mock_web3_instance.eth.estimate_gas.return_value = MOCK_GAS_LIMIT

        mock_web3_instance.eth.send_transaction.return_value = bytes.fromhex(MOCK_TX_HASH[2:])

        mock_receipt = {"transactionHash": bytes.fromhex(MOCK_TX_HASH[2:])}
        mock_web3_instance.eth.wait_for_transaction_receipt.return_value = mock_receipt

        mock_contract = Mock()
        mock_function = Mock()
        mock_function.call.return_value = "mock_result"
        mock_contract.functions = {"testFunction": lambda *args: mock_function}
        mock_web3_instance.eth.contract.return_value = mock_contract

        mock_web3_class.to_wei.return_value = MOCK_ONE_ETH_WEI
        mock_web3_class.to_hex.return_value = MOCK_TX_HASH
        mock_web3_class.to_checksum_address.return_value = MOCK_ADDRESS

        yield mock_web3_class


@pytest.fixture
def wallet_provider(mock_account, mock_web3):
    """Create a EthAccountWalletProvider instance."""
    mock_chain = Mock()
    mock_chain.rpc_urls = {"default": Mock(http=[MOCK_RPC_URL])}
    mock_chain.id = MOCK_CHAIN_ID

    chain_id_to_network_id = {MOCK_CHAIN_ID: MOCK_NETWORK_ID}
    network_id_to_chain = {MOCK_NETWORK_ID: mock_chain}

    with (
        patch.multiple(
            "coinbase_agentkit.wallet_providers.eth_account_wallet_provider",
            CHAIN_ID_TO_NETWORK_ID=chain_id_to_network_id,
            NETWORK_ID_TO_CHAIN=network_id_to_chain,
            Web3=mock_web3,
        ),
        patch("web3.Web3", mock_web3),
    ):
        config = EthAccountWalletProviderConfig(
            account=mock_account,
            chain_id=MOCK_CHAIN_ID,
            gas=EvmGasConfig(gas_limit_multiplier=1.5, fee_per_gas_multiplier=1.2),
        )

        provider = EthAccountWalletProvider(config)

        yield provider


class TestEthAccountWalletProvider:
    """Test suite for EthAccountWalletProvider."""

    def test_init_with_account(self, mock_account, mock_web3):
        """Test initialization with account."""
        with (
            patch(
                "coinbase_agentkit.wallet_providers.eth_account_wallet_provider.CHAIN_ID_TO_NETWORK_ID",
                {MOCK_CHAIN_ID: MOCK_NETWORK_ID},
            ),
            patch(
                "coinbase_agentkit.wallet_providers.eth_account_wallet_provider.NETWORK_ID_TO_CHAIN",
                {
                    MOCK_NETWORK_ID: Mock(
                        rpc_urls={"default": Mock(http=[MOCK_RPC_URL])}, id=MOCK_CHAIN_ID
                    )
                },
            ),
        ):
            config = EthAccountWalletProviderConfig(account=mock_account, chain_id=MOCK_CHAIN_ID)

            provider = EthAccountWalletProvider(config)

            assert provider.account == mock_account
            assert provider.get_address() == MOCK_ADDRESS
            assert provider.get_network().chain_id == MOCK_CHAIN_ID
            assert provider._gas_limit_multiplier == 1.2

    def test_init_with_custom_rpc(self, mock_account, mock_web3):
        """Test initialization with custom RPC URL."""
        custom_rpc = "https://custom-rpc.example.com"
        
        config = EthAccountWalletProviderConfig(
            account=mock_account, chain_id=MOCK_CHAIN_ID, rpc_url=custom_rpc
        )
        
        with patch("coinbase_agentkit.wallet_providers.eth_account_wallet_provider.CHAIN_ID_TO_NETWORK_ID", {MOCK_CHAIN_ID: MOCK_NETWORK_ID}):
            provider = EthAccountWalletProvider(config)
            assert provider is not None
        
        mock_web3.HTTPProvider.assert_called_with(custom_rpc)

    def test_init_with_gas_config(self, mock_account, mock_web3):
        """Test initialization with gas configuration."""
        with (
            patch(
                "coinbase_agentkit.wallet_providers.eth_account_wallet_provider.CHAIN_ID_TO_NETWORK_ID",
                {MOCK_CHAIN_ID: MOCK_NETWORK_ID},
            ),
            patch(
                "coinbase_agentkit.wallet_providers.eth_account_wallet_provider.NETWORK_ID_TO_CHAIN",
                {
                    MOCK_NETWORK_ID: Mock(
                        rpc_urls={"default": Mock(http=[MOCK_RPC_URL])}, id=MOCK_CHAIN_ID
                    )
                },
            ),
        ):
            config = EthAccountWalletProviderConfig(
                account=mock_account,
                chain_id=MOCK_CHAIN_ID,
                gas=EvmGasConfig(gas_limit_multiplier=2.0, fee_per_gas_multiplier=1.5),
            )

            provider = EthAccountWalletProvider(config)

            assert provider._gas_limit_multiplier == 2.0
            assert provider._fee_per_gas_multiplier == 1.5

    def test_get_address(self, wallet_provider, mock_account):
        """Test get_address method."""
        assert wallet_provider.get_address() == MOCK_ADDRESS

    def test_get_network(self, wallet_provider):
        """Test get_network method."""
        network = wallet_provider.get_network()
        assert isinstance(network, Network)
        assert network.protocol_family == "evm"
        assert network.chain_id == MOCK_CHAIN_ID

    def test_get_balance(self, wallet_provider, mock_web3):
        """Test get_balance method."""
        balance = wallet_provider.get_balance()
        assert balance == MOCK_BALANCE
        mock_web3.return_value.eth.get_balance.assert_called_once_with(MOCK_ADDRESS)

    def test_get_name(self, wallet_provider):
        """Test get_name method."""
        assert wallet_provider.get_name() == "eth-account"

    def test_sign_message(self, wallet_provider, mock_account):
        """Test sign_message method."""
        message = "Hello, world!"

        with patch(
            "coinbase_agentkit.wallet_providers.eth_account_wallet_provider.encode_defunct"
        ) as mock_encode:
            mock_encode.return_value = "encoded_message"

            signature = wallet_provider.sign_message(message)

            assert signature == MOCK_SIGNATURE_BYTES
            mock_encode.assert_called_once_with(
                message.encode() if isinstance(message, str) else message
            )
            mock_account.sign_message.assert_called_once_with("encoded_message")
            assert mock_encode.call_count == 1

    def test_sign_typed_data(self, wallet_provider, mock_account):
        """Test sign_typed_data method."""
        typed_data = {
            "types": {"EIP712Domain": []},
            "primaryType": "Test",
            "domain": {},
            "message": {},
        }

        signature = wallet_provider.sign_typed_data(typed_data)

        assert signature == MOCK_SIGNATURE_BYTES
        mock_account.sign_typed_data.assert_called_once_with(full_message=typed_data)

    def test_sign_transaction(self, wallet_provider, mock_account):
        """Test sign_transaction method."""
        transaction = {
            "to": MOCK_ADDRESS_TO,
            "value": MOCK_ONE_ETH_WEI,
            "gasPrice": MOCK_GAS_PRICE,
            "gas": MOCK_GAS_LIMIT,
            "nonce": 0,
            "chainId": MOCK_CHAIN_ID,
        }

        result = wallet_provider.sign_transaction(transaction)

        assert result is not None
        mock_account.sign_transaction.assert_called_once_with(transaction)

    def test_send_transaction(self, wallet_provider, mock_web3):
        """Test send_transaction method."""
        transaction = {
            "to": MOCK_ADDRESS,
            "value": MOCK_ONE_ETH_WEI,
        }

        tx_hash = wallet_provider.send_transaction(transaction)

        assert tx_hash == MOCK_TX_HASH
        mock_web3.to_hex.assert_called_once_with(bytes.fromhex(MOCK_TX_HASH[2:]))

    def test_wait_for_transaction_receipt(self, wallet_provider, mock_web3):
        """Test wait_for_transaction_receipt method."""
        tx_hash = "0x1234567890123456789012345678901234567890123456789012345678901234"

        receipt = wallet_provider.wait_for_transaction_receipt(tx_hash)

        assert receipt == {"transactionHash": bytes.fromhex(MOCK_TX_HASH[2:])}
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

    def test_estimate_fees(self, wallet_provider, mock_web3):
        """Test estimate_fees method."""
        with patch.object(wallet_provider, "_fee_per_gas_multiplier", MOCK_FEE_MULTIPLIER):
            max_priority_fee, max_fee = wallet_provider.estimate_fees()

            assert max_fee > max_priority_fee
            assert max_priority_fee == MOCK_PRIORITY_FEE_WEI

    def test_native_transfer(self, wallet_provider, mock_web3):
        """Test native_transfer method."""
        to_address = MOCK_ADDRESS_TO
        amount = Decimal("1.0")

        with (
            patch.object(wallet_provider, "send_transaction") as mock_send,
            patch.object(wallet_provider, "wait_for_transaction_receipt") as mock_wait,
        ):
            mock_send.return_value = MOCK_TX_HASH
            mock_receipt = {"transactionHash": bytes.fromhex(MOCK_TX_HASH[2:])}
            mock_wait.return_value = mock_receipt

            tx_hash = wallet_provider.native_transfer(to_address, amount)

            expected_hash = MOCK_TX_HASH[2:]
            assert tx_hash == expected_hash
            mock_web3.to_wei.assert_called_with(amount, "ether")
            mock_web3.to_checksum_address.assert_called_with(to_address)
            mock_send.assert_called_once()
            mock_wait.assert_called_once_with(MOCK_TX_HASH)

    def test_native_transfer_failure(self, wallet_provider, mock_web3):
        """Test native_transfer method when transfer fails."""
        to_address = MOCK_ADDRESS_TO
        amount = Decimal("1.0")

        with (
            patch.object(
                wallet_provider, "send_transaction", side_effect=Exception("Transfer failed")
            ),
            pytest.raises(Exception, match="Failed to transfer native tokens"),
        ):
            wallet_provider.native_transfer(to_address, amount)
