"""Common test fixtures for CDP Wallet Provider tests."""

from unittest.mock import Mock, patch

import pytest
from cdp import Wallet

from coinbase_agentkit.wallet_providers.cdp_wallet_provider import (
    CdpWalletProvider,
    CdpWalletProviderConfig,
)
from coinbase_agentkit.wallet_providers.evm_wallet_provider import EvmGasConfig

# =========================================================
# test constants
# =========================================================

# mock API key constants
MOCK_API_KEY_NAME = "test_api_key_name"
MOCK_API_KEY_PRIVATE_KEY = "test_api_key_private_key"

# mock address and network constants
MOCK_ADDRESS = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
MOCK_CHAIN_ID = "84532"
MOCK_NETWORK_ID = "base-sepolia"
MOCK_MNEMONIC = "test test test test test test test test test test test junk"
MOCK_WALLET_DATA = {
    "network_id": MOCK_NETWORK_ID,
    "addresses": [{"address_id": MOCK_ADDRESS, "derivation_path": "m/44'/60'/0'/0/0"}],
}

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
    payload_signature.signature = MOCK_SIGNATURE
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
