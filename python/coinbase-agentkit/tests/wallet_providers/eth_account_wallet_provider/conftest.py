"""Common test fixtures for ETH Account Wallet Provider tests."""

from decimal import Decimal
from unittest.mock import Mock, patch

import pytest
from eth_account.account import LocalAccount
from eth_account.datastructures import SignedTransaction

from coinbase_agentkit.wallet_providers.eth_account_wallet_provider import (
    EthAccountWalletProvider,
    EthAccountWalletProviderConfig,
)
from coinbase_agentkit.wallet_providers.evm_wallet_provider import EvmGasConfig

# =========================================================
# test constants
# =========================================================

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

# =========================================================
# test fixtures
# =========================================================


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
