"""Tests for the CDP Wallet Provider."""

import json
import os
from decimal import Decimal
from unittest.mock import ANY, Mock, patch

import pytest
from cdp import Wallet, WalletData

from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers.cdp_wallet_provider import (
    CdpWalletProvider,
    CdpWalletProviderConfig,
)
from coinbase_agentkit.wallet_providers.evm_wallet_provider import EvmGasConfig

MOCK_API_KEY_NAME = "test_api_key_name"
MOCK_API_KEY_PRIVATE_KEY = "test_api_key_private_key"

MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
MOCK_CHAIN_ID = "84532"
MOCK_NETWORK_ID = "base-sepolia"
MOCK_MNEMONIC = "test test test test test test test test test test test junk"
MOCK_WALLET_DATA = {
    "network_id": MOCK_NETWORK_ID,
    "addresses": [{"address_id": MOCK_ADDRESS, "derivation_path": "m/44'/60'/0'/0/0"}],
}

MOCK_TRANSACTION_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
MOCK_ADDRESS_TO = "0x1234567890123456789012345678901234567890"

MOCK_BASE_FEE_PER_GAS = 10000000000
MOCK_GAS_LIMIT = 21000
MOCK_MAX_FEE_PER_GAS = 30000000000
MOCK_PRIORITY_FEE_PER_GAS = 1000000000

MOCK_ONE_ETH_WEI = 1000000000000000000


@pytest.fixture
def mock_cdp():
    """Create a mock for CDP SDK."""
    with patch("coinbase_agentkit.wallet_providers.cdp_wallet_provider.Cdp") as mock_cdp:
        yield mock_cdp


@pytest.fixture
def mock_wallet():
    """Create a mock CDP wallet."""
    mock = Mock(spec=Wallet)
    mock.network_id = MOCK_NETWORK_ID
    mock.default_address.address_id = MOCK_ADDRESS
    mock.balance.return_value = 1.0

    transfer_result = Mock()
    transfer_result.transaction_hash = MOCK_TRANSACTION_HASH
    transfer_result.wait.return_value = None
    mock.transfer.return_value = transfer_result

    payload_signature = Mock()
    payload_signature.signature = "0x123456"
    mock.sign_payload.return_value = payload_signature

    mock.deploy_contract.return_value = Mock()
    mock.deploy_nft.return_value = Mock()
    mock.deploy_token.return_value = Mock()

    trade_result = Mock()
    trade_result.to_amount = "0.5"
    trade_result.transaction = Mock()
    trade_result.transaction.transaction_hash = MOCK_TRANSACTION_HASH
    trade_result.transaction.transaction_link = f"https://example.com/tx/{MOCK_TRANSACTION_HASH}"
    trade_result.wait.return_value = trade_result
    mock.trade.return_value = trade_result

    return mock


@pytest.fixture
def mock_web3():
    """Create a mock Web3 instance."""
    with patch("coinbase_agentkit.wallet_providers.cdp_wallet_provider.Web3") as mock_web3:
        mock_web3_instance = Mock()
        mock_web3.return_value = mock_web3_instance

        mock_block = {"baseFeePerGas": MOCK_BASE_FEE_PER_GAS}
        mock_web3_instance.eth.get_block.return_value = mock_block

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
def mocked_wallet_provider(mock_cdp, mock_wallet, mock_web3):
    """Create a mocked CdpWalletProvider with patched dependencies."""
    with (
        patch("coinbase_agentkit.wallet_providers.cdp_wallet_provider.Wallet") as mock_wallet_class,
        patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.WalletData"
        ) as mock_wallet_data,
    ):
        mock_wallet_class.create.return_value = mock_wallet
        mock_wallet_class.import_wallet.return_value = mock_wallet
        mock_wallet_class.import_data.return_value = mock_wallet

        mock_wallet_data.from_dict.return_value = "mock_wallet_data"

        config = CdpWalletProviderConfig(
            api_key_name=MOCK_API_KEY_NAME,
            api_key_private_key=MOCK_API_KEY_PRIVATE_KEY,
            network_id=MOCK_NETWORK_ID,
            mnemonic_phrase=MOCK_MNEMONIC,
            gas=EvmGasConfig(gas_limit_multiplier=1.5, fee_per_gas_multiplier=1.2),
        )

        wallet_provider = CdpWalletProvider(config)

        yield wallet_provider


class TestCdpWalletProvider:
    """Test suite for CdpWalletProvider."""

    def test_init_with_mnemonic(self, mock_cdp, mock_wallet):
        """Test initialization with mnemonic phrase."""
        with patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.Wallet"
        ) as mock_wallet_class:
            mock_wallet_class.import_wallet.return_value = mock_wallet

            config = CdpWalletProviderConfig(
                mnemonic_phrase=MOCK_MNEMONIC, network_id=MOCK_NETWORK_ID
            )

            provider = CdpWalletProvider(config)

            mock_cdp.configure_from_json.assert_called_once()
            mock_wallet_class.import_wallet.assert_called_once()
            assert provider.get_address() == MOCK_ADDRESS
            assert provider.get_network().network_id == MOCK_NETWORK_ID

    def test_init_with_wallet_data(self, mock_cdp, mock_wallet):
        """Test initialization with wallet data."""
        with (
            patch(
                "coinbase_agentkit.wallet_providers.cdp_wallet_provider.Wallet"
            ) as mock_wallet_class,
            patch(
                "coinbase_agentkit.wallet_providers.cdp_wallet_provider.WalletData"
            ) as mock_wallet_data,
        ):
            mock_wallet_class.import_data.return_value = mock_wallet
            mock_wallet_data.from_dict.return_value = "mock_wallet_data"

            config = CdpWalletProviderConfig(wallet_data=json.dumps(MOCK_WALLET_DATA))

            provider = CdpWalletProvider(config)

            mock_cdp.configure_from_json.assert_called_once()
            mock_wallet_class.import_data.assert_called_once_with("mock_wallet_data")
            assert provider.get_address() == MOCK_ADDRESS

    def test_init_with_api_keys(self, mock_cdp, mock_wallet):
        """Test initialization with API keys."""
        with patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.Wallet"
        ) as mock_wallet_class:
            mock_wallet_class.create.return_value = mock_wallet

            config = CdpWalletProviderConfig(
                api_key_name=MOCK_API_KEY_NAME, api_key_private_key=MOCK_API_KEY_PRIVATE_KEY
            )

            CdpWalletProvider(config)

            mock_cdp.configure.assert_called_once_with(
                api_key_name=MOCK_API_KEY_NAME,
                private_key=MOCK_API_KEY_PRIVATE_KEY,
                source="agentkit",
                source_version=ANY,
            )

    def test_init_without_config(self, mock_cdp, mock_wallet):
        """Test initialization without config (should use environment variables)."""
        with (
            patch(
                "coinbase_agentkit.wallet_providers.cdp_wallet_provider.Wallet"
            ) as mock_wallet_class,
            patch.dict(
                os.environ,
                {
                    "CDP_API_KEY_NAME": MOCK_API_KEY_NAME,
                    "CDP_API_KEY_PRIVATE_KEY": MOCK_API_KEY_PRIVATE_KEY,
                    "NETWORK_ID": MOCK_NETWORK_ID,
                },
            ),
        ):
            mock_wallet_class.create.return_value = mock_wallet

            provider = CdpWalletProvider()

            mock_cdp.configure.assert_called_once_with(
                api_key_name=MOCK_API_KEY_NAME,
                private_key=MOCK_API_KEY_PRIVATE_KEY,
                source="agentkit",
                source_version=ANY,
            )
            assert provider.get_address() == MOCK_ADDRESS

    def test_import_error(self, mock_cdp):
        """Test handling of import error."""
        with patch("coinbase_agentkit.wallet_providers.cdp_wallet_provider.Cdp") as cdp_mock:
            cdp_mock.configure.side_effect = ImportError("Failed to import cdp")
            cdp_mock.configure_from_json.side_effect = ImportError("Failed to import cdp")

            config = CdpWalletProviderConfig()

            with pytest.raises(ImportError, match="Failed to import cdp"):
                CdpWalletProvider(config)

    def test_initialization_error(self, mock_cdp):
        """Test handling of initialization error."""
        with patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.Wallet.create",
            side_effect=Exception("Failed to create wallet"),
        ):
            config = CdpWalletProviderConfig()

            with pytest.raises(ValueError, match="Failed to initialize CDP wallet"):
                CdpWalletProvider(config)

    def test_get_address(self, mocked_wallet_provider):
        """Test get_address method."""
        assert mocked_wallet_provider.get_address() == MOCK_ADDRESS

    def test_get_balance(self, mocked_wallet_provider, mock_wallet):
        """Test get_balance method."""
        provider_wallet = mocked_wallet_provider._wallet
        provider_wallet.balance.return_value = 2.0

        with patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.Web3.to_wei",
            return_value=2 * MOCK_ONE_ETH_WEI,
        ):
            balance = mocked_wallet_provider.get_balance()
            assert balance == Decimal(2 * MOCK_ONE_ETH_WEI)
            provider_wallet.balance.assert_called_once_with("eth")

    def test_get_balance_without_wallet(self, mocked_wallet_provider):
        """Test get_balance method when wallet is not initialized."""
        mocked_wallet_provider._wallet = None
        with pytest.raises(Exception, match="Wallet not initialized"):
            mocked_wallet_provider.get_balance()

    def test_get_name(self, mocked_wallet_provider):
        """Test get_name method."""
        assert mocked_wallet_provider.get_name() == "cdp_wallet_provider"

    def test_get_network(self, mocked_wallet_provider):
        """Test get_network method."""
        network = mocked_wallet_provider.get_network()
        assert isinstance(network, Network)
        assert network.protocol_family == "evm"
        assert network.network_id == MOCK_NETWORK_ID
        assert network.chain_id == MOCK_CHAIN_ID

    def test_native_transfer(self, mocked_wallet_provider, mock_wallet):
        """Test native_transfer method."""
        # Get the wallet that's actually being used by the provider
        provider_wallet = mocked_wallet_provider._wallet
        to_address = MOCK_ADDRESS_TO
        amount = Decimal("0.5")

        # Mock the Web3.to_checksum_address to ensure consistent address format
        with patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.Web3.to_checksum_address",
            return_value=to_address,
        ):
            tx_hash = mocked_wallet_provider.native_transfer(to_address, amount)

            assert tx_hash == MOCK_TRANSACTION_HASH
            provider_wallet.transfer.assert_called_once_with(
                amount=amount, asset_id="eth", destination=to_address, gasless=False
            )

    def test_native_transfer_without_wallet(self, mocked_wallet_provider):
        """Test native_transfer method when wallet is not initialized."""
        mocked_wallet_provider._wallet = None
        with pytest.raises(Exception, match="Wallet not initialized"):
            mocked_wallet_provider.native_transfer("0x1234", Decimal("0.5"))

    def test_native_transfer_failure(self, mocked_wallet_provider, mock_wallet):
        """Test native_transfer method when transfer fails."""
        mock_wallet.transfer.side_effect = Exception("Transfer failed")

        with pytest.raises(Exception, match="Failed to transfer native tokens"):
            mocked_wallet_provider.native_transfer("0x1234", Decimal("0.5"))

    def test_read_contract(self, mocked_wallet_provider, mock_web3):
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

        result = mocked_wallet_provider.read_contract(
            contract_address, abi, "testFunction", ["arg1"]
        )

        assert result == "mock_result"
        mock_web3.return_value.eth.contract.assert_called_once_with(
            address=contract_address, abi=abi
        )

    def test_sign_message(self, mocked_wallet_provider, mock_wallet):
        """Test sign_message method."""
        message = "Hello, world!"

        with patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.hash_message"
        ) as mock_hash_message:
            mock_hash_message.return_value = "mock_hash"

            signature = mocked_wallet_provider.sign_message(message)

            assert signature == "0x123456"
            mock_hash_message.assert_called_once_with(message)
            mock_wallet.sign_payload.assert_called_once_with("mock_hash")

    def test_sign_message_without_wallet(self, mocked_wallet_provider):
        """Test sign_message method when wallet is not initialized."""
        mocked_wallet_provider._wallet = None
        with pytest.raises(Exception, match="Wallet not initialized"):
            mocked_wallet_provider.sign_message("Hello, world!")

    def test_sign_typed_data(self, mocked_wallet_provider, mock_wallet):
        """Test sign_typed_data method."""
        typed_data = {
            "types": {"EIP712Domain": []},
            "primaryType": "Test",
            "domain": {},
            "message": {},
        }

        with patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.hash_typed_data_message"
        ) as mock_hash:
            mock_hash.return_value = "mock_hash"

            signature = mocked_wallet_provider.sign_typed_data(typed_data)

            assert signature == "0x123456"
            mock_hash.assert_called_once_with(typed_data)
            mock_wallet.sign_payload.assert_called_once_with("mock_hash")

    def test_sign_typed_data_without_wallet(self, mocked_wallet_provider):
        """Test sign_typed_data method when wallet is not initialized."""
        mocked_wallet_provider._wallet = None
        typed_data = {
            "types": {"EIP712Domain": []},
            "primaryType": "Test",
            "domain": {},
            "message": {},
        }

        with pytest.raises(Exception, match="Wallet not initialized"):
            mocked_wallet_provider.sign_typed_data(typed_data)

    def test_sign_transaction(self, mocked_wallet_provider, mock_wallet):
        """Test sign_transaction method."""
        transaction = {
            "to": MOCK_ADDRESS_TO,
            "value": MOCK_ONE_ETH_WEI,
            "data": "0x",
            "nonce": 0,
            "gas": MOCK_GAS_LIMIT,
            "maxFeePerGas": MOCK_MAX_FEE_PER_GAS,
            "maxPriorityFeePerGas": MOCK_PRIORITY_FEE_PER_GAS,
            "chainId": MOCK_CHAIN_ID,
            "type": 2,
        }

        with patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.DynamicFeeTransaction"
        ) as mock_tx:
            mock_tx_instance = Mock()
            mock_tx_instance.hash.return_value = bytes.fromhex("abcdef")
            mock_tx.from_dict.return_value = mock_tx_instance

            signature = mocked_wallet_provider.sign_transaction(transaction)

            assert signature == "0x123456"
            mock_tx.from_dict.assert_called_once_with(transaction)
            mock_wallet.sign_payload.assert_called_once_with("abcdef")

    def test_sign_transaction_without_wallet(self, mocked_wallet_provider):
        """Test sign_transaction method when wallet is not initialized."""
        mocked_wallet_provider._wallet = None
        with pytest.raises(Exception, match="Wallet not initialized"):
            mocked_wallet_provider.sign_transaction({})

    def test_send_transaction(self, mocked_wallet_provider):
        """Test send_transaction method."""
        transaction = {"to": MOCK_ADDRESS_TO, "value": MOCK_ONE_ETH_WEI, "data": "0x"}

        with (
            patch.object(mocked_wallet_provider, "sign_transaction") as mock_sign,
            patch(
                "coinbase_agentkit.wallet_providers.cdp_wallet_provider.DynamicFeeTransaction"
            ) as mock_tx,
            patch(
                "coinbase_agentkit.wallet_providers.cdp_wallet_provider.ExternalAddress"
            ) as mock_addr,
        ):
            # sig format: 0x + r(64 chars) + s(64 chars) + v(2 chars)
            hex_signature = "0x" + "a" * 64 + "b" * 64 + "1b"
            mock_sign.return_value = hex_signature

            mock_tx_instance = Mock()
            mock_tx_instance.payload.return_value = bytes.fromhex("1234")
            mock_tx.from_dict.return_value = mock_tx_instance

            mock_addr_instance = Mock()
            mock_addr.return_value = mock_addr_instance
            mock_broadcast_result = Mock()
            mock_broadcast_result.transaction_hash = MOCK_TRANSACTION_HASH
            mock_addr_instance.broadcast_external_transaction.return_value = mock_broadcast_result

            tx_hash = mocked_wallet_provider.send_transaction(transaction)

            assert tx_hash == MOCK_TRANSACTION_HASH
            mock_sign.assert_called_once()
            mock_addr.assert_called_once_with(MOCK_NETWORK_ID, MOCK_ADDRESS)
            mock_addr_instance.broadcast_external_transaction.assert_called_once_with("021234")

    def test_wait_for_transaction_receipt(self, mocked_wallet_provider, mock_web3):
        """Test wait_for_transaction_receipt method."""
        tx_hash = "0x1234567890123456789012345678901234567890123456789012345678901234"

        receipt = mocked_wallet_provider.wait_for_transaction_receipt(tx_hash)

        assert receipt == {"transactionHash": bytes.fromhex(MOCK_TRANSACTION_HASH[2:])}
        mock_web3.return_value.eth.wait_for_transaction_receipt.assert_called_once_with(
            tx_hash, timeout=120, poll_latency=0.1
        )

    def test_deploy_contract(self, mocked_wallet_provider, mock_wallet):
        """Test deploy_contract method."""
        solidity_version = "0.8.9"
        solidity_input_json = "{}"
        contract_name = "TestContract"
        constructor_args = {"arg1": "value1"}

        result = mocked_wallet_provider.deploy_contract(
            solidity_version, solidity_input_json, contract_name, constructor_args
        )

        assert result is not None
        mock_wallet.deploy_contract.assert_called_once_with(
            solidity_version=solidity_version,
            solidity_input_json=solidity_input_json,
            contract_name=contract_name,
            constructor_args=constructor_args,
        )

    def test_deploy_contract_without_wallet(self, mocked_wallet_provider):
        """Test deploy_contract method when wallet is not initialized."""
        mocked_wallet_provider._wallet = None
        with pytest.raises(Exception, match="Wallet not initialized"):
            mocked_wallet_provider.deploy_contract("0.8.9", "{}", "TestContract", {})

    def test_deploy_contract_failure(self, mocked_wallet_provider, mock_wallet):
        """Test deploy_contract method when deployment fails."""
        mock_wallet.deploy_contract.side_effect = Exception("Deployment failed")

        with pytest.raises(Exception, match="Failed to deploy contract"):
            mocked_wallet_provider.deploy_contract("0.8.9", "{}", "TestContract", {})

    def test_deploy_nft(self, mocked_wallet_provider, mock_wallet):
        """Test deploy_nft method."""
        name = "Test NFT"
        symbol = "TNFT"
        base_uri = "https://example.com/metadata/"

        result = mocked_wallet_provider.deploy_nft(name, symbol, base_uri)

        assert result is not None
        mock_wallet.deploy_nft.assert_called_once_with(name=name, symbol=symbol, base_uri=base_uri)

    def test_deploy_nft_without_wallet(self, mocked_wallet_provider):
        """Test deploy_nft method when wallet is not initialized."""
        mocked_wallet_provider._wallet = None
        with pytest.raises(Exception, match="Wallet not initialized"):
            mocked_wallet_provider.deploy_nft("Test", "TEST", "https://example.com/")

    def test_deploy_nft_failure(self, mocked_wallet_provider, mock_wallet):
        """Test deploy_nft method when deployment fails."""
        mock_wallet.deploy_nft.side_effect = Exception("NFT deployment failed")

        with pytest.raises(Exception, match="Failed to deploy NFT"):
            mocked_wallet_provider.deploy_nft("Test", "TEST", "https://example.com/")

    def test_deploy_token(self, mocked_wallet_provider, mock_wallet):
        """Test deploy_token method."""
        name = "Test Token"
        symbol = "TT"
        total_supply = "1000000"

        result = mocked_wallet_provider.deploy_token(name, symbol, total_supply)

        assert result is not None
        mock_wallet.deploy_token.assert_called_once_with(
            name=name, symbol=symbol, total_supply=total_supply
        )

    def test_deploy_token_without_wallet(self, mocked_wallet_provider):
        """Test deploy_token method when wallet is not initialized."""
        mocked_wallet_provider._wallet = None
        with pytest.raises(Exception, match="Wallet not initialized"):
            mocked_wallet_provider.deploy_token("Test", "TEST", "1000000")

    def test_deploy_token_failure(self, mocked_wallet_provider, mock_wallet):
        """Test deploy_token method when deployment fails."""
        mock_wallet.deploy_token.side_effect = Exception("Token deployment failed")

        with pytest.raises(Exception, match="Failed to deploy token"):
            mocked_wallet_provider.deploy_token("Test", "TEST", "1000000")

    def test_trade(self, mocked_wallet_provider, mock_wallet):
        """Test trade method."""
        amount = "1.0"
        from_asset_id = "eth"
        to_asset_id = "usdc"

        result = mocked_wallet_provider.trade(amount, from_asset_id, to_asset_id)

        assert "Traded 1.0 of eth for 0.5 of usdc" in result
        assert f"Transaction hash for the trade: {MOCK_TRANSACTION_HASH}" in result
        mock_wallet.trade.assert_called_once_with(
            amount=amount, from_asset_id=from_asset_id, to_asset_id=to_asset_id
        )

    def test_trade_without_wallet(self, mocked_wallet_provider):
        """Test trade method when wallet is not initialized."""
        mocked_wallet_provider._wallet = None
        with pytest.raises(Exception, match="Wallet not initialized"):
            mocked_wallet_provider.trade("1.0", "eth", "usdc")

    def test_trade_failure(self, mocked_wallet_provider, mock_wallet):
        """Test trade method when trade fails."""
        mock_wallet.trade.side_effect = Exception("Trade failed")

        with pytest.raises(Exception, match="Error trading assets"):
            mocked_wallet_provider.trade("1.0", "eth", "usdc")

    def test_export_wallet(self, mocked_wallet_provider, mock_wallet):
        """Test export_wallet method."""
        mock_wallet_data = Mock(spec=WalletData)
        mock_wallet.export_data.return_value = mock_wallet_data

        result = mocked_wallet_provider.export_wallet()

        assert result == mock_wallet_data
        mock_wallet.export_data.assert_called_once()

    def test_export_wallet_without_wallet(self, mocked_wallet_provider):
        """Test export_wallet method when wallet is not initialized."""
        mocked_wallet_provider._wallet = None
        with pytest.raises(Exception, match="Wallet not initialized"):
            mocked_wallet_provider.export_wallet()

    def test_network_error_handling(self, mocked_wallet_provider, mock_wallet):
        """Test handling of network errors during transactions."""
        # Mock a network error when attempting to transfer
        mock_wallet.transfer.side_effect = Exception("Network connection error")
        
        # Test that the provider properly wraps and raises the error
        with pytest.raises(Exception, match="Failed to transfer native tokens"):
            mocked_wallet_provider.native_transfer("0x1234", Decimal("0.5"))
        
        # Test read_contract error handling
        with patch.object(
            mocked_wallet_provider._web3.eth, 
            "contract", 
            side_effect=Exception("Contract read error")
        ):
            with pytest.raises(Exception):
                mocked_wallet_provider.read_contract(
                    "0x1234", 
                    [{"name": "test", "type": "function", "inputs": [], "outputs": [{"type": "string"}]}], 
                    "test"
                )
        
        # Test wait_for_transaction_receipt error handling
        with patch.object(
            mocked_wallet_provider._web3.eth, 
            "wait_for_transaction_receipt", 
            side_effect=Exception("Timeout waiting for receipt")
        ):
            with pytest.raises(Exception):
                mocked_wallet_provider.wait_for_transaction_receipt("0x1234")
