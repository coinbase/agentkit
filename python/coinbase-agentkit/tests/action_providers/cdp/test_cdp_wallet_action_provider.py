"""Tests for CDP wallet action provider."""

from unittest.mock import Mock

import pytest

from coinbase_agentkit.action_providers.cdp.cdp_wallet_action_provider import (
    CdpWalletActionProvider,
    cdp_wallet_action_provider,
)
from coinbase_agentkit.action_providers.cdp.schemas import TradeSchema

from .conftest import (
    MOCK_CONSTRUCTOR_ARGS,
    MOCK_CONTRACT_ADDRESS,
    MOCK_CONTRACT_NAME,
    MOCK_EXPLORER_URL,
    MOCK_FROM_ASSET_ID,
    MOCK_MAINNET_TX_HASH,
    MOCK_MAINNET_TX_LINK,
    MOCK_NFT_BASE_URI,
    MOCK_NFT_NAME,
    MOCK_NFT_SYMBOL,
    MOCK_SOLIDITY_INPUT_JSON,
    MOCK_SOLIDITY_VERSION,
    MOCK_TESTNET_NETWORK_ID,
    MOCK_TO_AMOUNT,
    MOCK_TO_ASSET_ID,
    MOCK_TOKEN_SUPPLY,
    MOCK_TX_HASH,
    MOCK_VALUE,
)


def test_deploy_contract(mock_wallet, mock_contract_result):
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


def test_deploy_contract_error(mock_wallet_provider):
    """Test contract deployment error handling."""
    provider = cdp_wallet_action_provider()

    error_message = "Contract deployment failed"
    mock_wallet_provider.deploy_contract.side_effect = Exception(error_message)

    args = {
        "solidity_version": MOCK_SOLIDITY_VERSION,
        "solidity_input_json": MOCK_SOLIDITY_INPUT_JSON,
        "contract_name": MOCK_CONTRACT_NAME,
        "constructor_args": MOCK_CONSTRUCTOR_ARGS,
    }

    result = provider.deploy_contract(mock_wallet_provider, args)
    assert f"Error deploying contract: {error_message}" in result


def test_deploy_nft(mock_wallet, mock_contract_result):
    """Test NFT deployment."""
    provider = cdp_wallet_action_provider()

    mock_wallet.get_network.return_value.network_id = MOCK_TESTNET_NETWORK_ID
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
    assert f"on network {MOCK_TESTNET_NETWORK_ID}" in result
    assert f"to address {MOCK_CONTRACT_ADDRESS}" in result
    assert f"Transaction hash for the deployment: {MOCK_TX_HASH}" in result
    assert f"Transaction link for the deployment: {MOCK_EXPLORER_URL}/{MOCK_TX_HASH}" in result


def test_deploy_nft_error(mock_wallet):
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


def test_deploy_token(mock_wallet, mock_contract):
    """Test token deployment."""
    provider = cdp_wallet_action_provider()

    mock_wallet.deploy_token.return_value = mock_contract

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


def test_deploy_token_error(mock_wallet):
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


def test_trade_input_model_valid():
    """Test that TradeInput accepts valid parameters."""
    input_model = TradeSchema(
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
        TradeSchema()


def test_trade_success(mock_wallet_provider):
    """Test successful trade with valid parameters."""
    mock_trade_response = "\n".join(
        [
            f"Traded {MOCK_VALUE} of {MOCK_FROM_ASSET_ID} for {MOCK_TO_AMOUNT} of {MOCK_TO_ASSET_ID}.",
            f"Transaction hash for the trade: {MOCK_MAINNET_TX_HASH}",
            f"Transaction link for the trade: {MOCK_MAINNET_TX_LINK}",
        ]
    )
    mock_wallet_provider.trade.return_value = mock_trade_response

    provider = CdpWalletActionProvider()
    action_response = provider.trade(
        mock_wallet_provider,
        {
            "value": MOCK_VALUE,
            "from_asset_id": MOCK_FROM_ASSET_ID,
            "to_asset_id": MOCK_TO_ASSET_ID,
        },
    )

    assert action_response == mock_trade_response

    mock_wallet_provider.trade.assert_called_once_with(
        amount=MOCK_VALUE,
        from_asset_id=MOCK_FROM_ASSET_ID,
        to_asset_id=MOCK_TO_ASSET_ID,
    )


def test_trade_api_error(mock_wallet_provider):
    """Test trade when API error occurs."""
    error_message = "API error"
    mock_wallet_provider.trade.side_effect = Exception(error_message)

    provider = CdpWalletActionProvider()
    action_response = provider.trade(
        mock_wallet_provider,
        {
            "value": MOCK_VALUE,
            "from_asset_id": MOCK_FROM_ASSET_ID,
            "to_asset_id": MOCK_TO_ASSET_ID,
        },
    )

    assert action_response == f"Error trading assets: {error_message}"
    mock_wallet_provider.trade.assert_called_once_with(
        amount=MOCK_VALUE,
        from_asset_id=MOCK_FROM_ASSET_ID,
        to_asset_id=MOCK_TO_ASSET_ID,
    )
