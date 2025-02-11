"""Tests for CDP wallet action provider."""

from coinbase_agentkit.action_providers.cdp.schemas import TradeInput
from coinbase_agentkit.wallet_providers.cdp_wallet_provider import CdpWalletProvider
from coinbase_agentkit.network import Network
from unittest.mock import Mock

import pytest

from coinbase_agentkit.action_providers.cdp.cdp_wallet_action_provider import (
    CdpWalletActionProvider,
    cdp_wallet_action_provider,
)

from .conftest import (
    MOCK_EXPLORER_URL,
    MOCK_TX_HASH,
)

MOCK_CONTRACT_ADDRESS = "0x123456789abcdef"
MOCK_NFT_BASE_URI = "https://www.test.xyz/metadata/"
MOCK_NFT_NAME = "Test Token"
MOCK_NFT_SYMBOL = "TEST"
MOCK_CONTRACT_NAME = "Test Contract"
MOCK_SOLIDITY_VERSION = "0.8.0"
MOCK_SOLIDITY_INPUT_JSON = "{}"
MOCK_CONSTRUCTOR_ARGS = {"arg1": "value1", "arg2": "value2"}
MOCK_TOKEN_SUPPLY = "1000000000000000000"


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
def mock_wallet():
    """Create a mock wallet."""
    wallet = Mock()
    wallet.network_id = "test-network"
    return wallet


@pytest.mark.usefixtures("mock_env")
class TestCdpWalletActionProvider:
    """Test CDP wallet action provider."""

    def test_deploy_contract(self, mock_wallet, mock_contract_result):
        """Test contract deployment."""
        provider = cdp_wallet_action_provider()

        contract = Mock()
        contract.wait.return_value = mock_contract_result
        mock_wallet.deploy_contract.return_value = contract

        args = {
            "solidity_version": MOCK_SOLIDITY_VERSION,
            "solidity_input_json": MOCK_SOLIDITY_INPUT_JSON,
            "contract_name": MOCK_CONTRACT_NAME,
            "constructor_args": MOCK_CONSTRUCTOR_ARGS,
        }

        result = provider.deploy_contract(mock_wallet, args)

        mock_wallet.deploy_contract.assert_called_once()
        assert f"Deployed contract {MOCK_CONTRACT_NAME}" in result
        assert f"at address {MOCK_CONTRACT_ADDRESS}" in result
        assert f"Transaction link: {MOCK_EXPLORER_URL}/{MOCK_TX_HASH}" in result

    def test_deploy_contract_error(self, mock_wallet):
        """Test contract deployment error handling."""
        provider = cdp_wallet_action_provider()

        error_message = "Contract deployment failed"
        mock_wallet.deploy_contract.side_effect = Exception(error_message)

        args = {
            "solidity_version": MOCK_SOLIDITY_VERSION,
            "solidity_input_json": MOCK_SOLIDITY_INPUT_JSON,
            "contract_name": MOCK_CONTRACT_NAME,
            "constructor_args": MOCK_CONSTRUCTOR_ARGS,
        }

        result = provider.deploy_contract(mock_wallet, args)
        assert f"Error deploying contract: {error_message}" in result

    def test_deploy_nft(self, mock_wallet, mock_contract_result):
        """Test NFT deployment."""
        provider = cdp_wallet_action_provider()

        mock_wallet.deploy_nft.return_value.wait.return_value = mock_contract_result

        args = {
            "name": MOCK_NFT_NAME,
            "symbol": MOCK_NFT_SYMBOL,
            "base_uri": MOCK_NFT_BASE_URI,
        }

        result = provider.deploy_nft(mock_wallet, args)

        mock_wallet.deploy_nft.assert_called_once_with(
            name=MOCK_NFT_NAME,
            symbol=MOCK_NFT_SYMBOL,
            base_uri=MOCK_NFT_BASE_URI,
        )
        assert f"Deployed NFT Collection {MOCK_NFT_NAME}" in result
        assert f"to address {MOCK_CONTRACT_ADDRESS}" in result
        assert f"Transaction hash for the deployment: {MOCK_TX_HASH}" in result
        assert f"Transaction link for the deployment: {MOCK_EXPLORER_URL}/{MOCK_TX_HASH}" in result

    def test_deploy_nft_error(self, mock_wallet):
        """Test NFT deployment error handling."""
        provider = cdp_wallet_action_provider()

        error_message = "NFT deployment failed"
        mock_wallet.deploy_nft.side_effect = Exception(error_message)

        args = {
            "name": MOCK_NFT_NAME,
            "symbol": MOCK_NFT_SYMBOL,
            "base_uri": MOCK_NFT_BASE_URI,
        }

        result = provider.deploy_nft(mock_wallet, args)
        assert f"Error deploying NFT {error_message}" in result

    def test_deploy_token(self, mock_wallet):
        """Test token deployment."""
        provider = cdp_wallet_action_provider()

        contract = Mock()
        contract.contract_address = MOCK_CONTRACT_ADDRESS
        contract.transaction = Mock(
            transaction_link=f"{MOCK_EXPLORER_URL}/{MOCK_TX_HASH}", transaction_hash=MOCK_TX_HASH
        )
        contract.wait.return_value = contract
        mock_wallet.deploy_token.return_value = contract

        args = {
            "name": MOCK_NFT_NAME,
            "symbol": MOCK_NFT_SYMBOL,
            "total_supply": MOCK_TOKEN_SUPPLY,
        }

        result = provider.deploy_token(mock_wallet, args)

        mock_wallet.deploy_token.assert_called_once_with(
            name=MOCK_NFT_NAME,
            symbol=MOCK_NFT_SYMBOL,
            total_supply=MOCK_TOKEN_SUPPLY,
        )
        assert f"Deployed ERC20 token contract {MOCK_NFT_NAME}" in result
        assert f"({MOCK_NFT_SYMBOL})" in result
        assert f"with total supply of {MOCK_TOKEN_SUPPLY} tokens" in result
        assert f"at address {MOCK_CONTRACT_ADDRESS}" in result
        assert f"Transaction link: {MOCK_EXPLORER_URL}/{MOCK_TX_HASH}" in result

    def test_deploy_token_error(self, mock_wallet):
        """Test token deployment error handling."""
        provider = cdp_wallet_action_provider()

        error_message = "Token deployment failed"
        mock_wallet.deploy_token.side_effect = Exception(error_message)

        args = {
            "name": MOCK_NFT_NAME,
            "symbol": MOCK_NFT_SYMBOL,
            "total_supply": MOCK_TOKEN_SUPPLY,
        }

        result = provider.deploy_token(mock_wallet, args)
        assert f"Error deploying token {error_message}" in result


MOCK_NETWORK_ID = "base-mainnet"
MOCK_CHAIN_ID = 8453
MOCK_VALUE = "3000"
MOCK_TO_AMOUNT = "1"
MOCK_FROM_ASSET_ID = "usdc"
MOCK_TO_ASSET_ID = "weth"
MOCK_TX_HASH = "0xffcc5fb66fd40f25af7a412025043096577d8c1e00f5fa2c95861a1ba6832a37"
MOCK_TX_LINK = "https://basescan.org/tx/0xffcc5fb66fd40f25af7a412025043096577d8c1e00f5fa2c95861a1ba6832a37"


def test_trade_input_model_valid():
    """Test that TradeInput accepts valid parameters."""
    input_model = TradeInput(
        value=MOCK_VALUE,
        from_asset_id=MOCK_FROM_ASSET_ID,
        to_asset_id=MOCK_TO_ASSET_ID,
    )

    assert input_model.value == MOCK_VALUE
    assert input_model.from_asset_id == MOCK_FROM_ASSET_ID
    assert input_model.to_asset_id == MOCK_TO_ASSET_ID


def test_trade_input_model_missing_params():
    """Test that TradeInput raises error when params are missing."""
    with pytest.raises(ValueError):
        TradeInput()


def test_trade_success():
    """Test successful trade with valid parameters."""
    mock_wallet_provider = Mock(spec=CdpWalletProvider)
    mock_wallet_provider.get_network.return_value = Network(
        protocol_family="evm",
        network_id=MOCK_NETWORK_ID,
        chain_id=MOCK_CHAIN_ID,
    )

    mock_trade_response = "\n".join([
        f"Traded {MOCK_VALUE} of {MOCK_FROM_ASSET_ID} for {MOCK_TO_AMOUNT} of {MOCK_TO_ASSET_ID}.",
        f"Transaction hash for the trade: {MOCK_TX_HASH}",
        f"Transaction link for the trade: {MOCK_TX_LINK}",
    ])
    mock_wallet_provider.trade.return_value = mock_trade_response

    provider = CdpWalletActionProvider()
    action_response = provider.trade(mock_wallet_provider, {
        "value": MOCK_VALUE,
        "from_asset_id": MOCK_FROM_ASSET_ID,
        "to_asset_id": MOCK_TO_ASSET_ID,
    })

    assert action_response == mock_trade_response

    mock_wallet_provider.trade.assert_called_once_with(
        amount=MOCK_VALUE,
        from_asset_id=MOCK_FROM_ASSET_ID,
        to_asset_id=MOCK_TO_ASSET_ID,
    )


def test_trade_testnet_error():
    """Test trade when on testnet network."""
    mock_wallet_provider = Mock(spec=CdpWalletProvider)
    mock_wallet_provider.get_network.return_value = Network(
        protocol_family="evm",
        network_id="base-sepolia",
        chain_id=84532,
    )

    provider = CdpWalletActionProvider()
    action_response = provider.trade(mock_wallet_provider, {
        "value": MOCK_VALUE,
        "from_asset_id": MOCK_FROM_ASSET_ID,
        "to_asset_id": MOCK_TO_ASSET_ID,
    })

    assert action_response == "Error: Trades are only supported on mainnet networks"
    mock_wallet_provider.trade.assert_not_called()


def test_trade_api_error():
    """Test trade when API error occurs."""
    mock_wallet_provider = Mock(spec=CdpWalletProvider)
    mock_wallet_provider.get_network.return_value = Network(
        protocol_family="evm",
        network_id=MOCK_NETWORK_ID,
        chain_id=MOCK_CHAIN_ID,
    )
    mock_wallet_provider.trade.side_effect = Exception("API error")

    provider = CdpWalletActionProvider()
    action_response = provider.trade(mock_wallet_provider, {
        "value": MOCK_VALUE,
        "from_asset_id": MOCK_FROM_ASSET_ID,
        "to_asset_id": MOCK_TO_ASSET_ID,
    })

    assert action_response == "Error trading assets: API error"
    mock_wallet_provider.trade.assert_called_once_with(
        amount=MOCK_VALUE,
        from_asset_id=MOCK_FROM_ASSET_ID,
        to_asset_id=MOCK_TO_ASSET_ID,
    )
