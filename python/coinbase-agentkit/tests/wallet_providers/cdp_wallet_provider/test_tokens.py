"""Tests for CDP Wallet Provider token and contract deployment operations."""

import pytest

# =========================================================
# token & contract deployment operations
# =========================================================


def test_deploy_contract(mocked_wallet_provider, mock_wallet):
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


def test_deploy_contract_without_wallet(mocked_wallet_provider):
    """Test deploy_contract method when wallet is not initialized."""
    mocked_wallet_provider._wallet = None
    with pytest.raises(Exception, match="Wallet not initialized"):
        mocked_wallet_provider.deploy_contract("0.8.9", "{}", "TestContract", {})


def test_deploy_contract_failure(mocked_wallet_provider, mock_wallet):
    """Test deploy_contract method when deployment fails."""
    mock_wallet.deploy_contract.side_effect = Exception("Deployment failed")

    with pytest.raises(Exception, match="Failed to deploy contract"):
        mocked_wallet_provider.deploy_contract("0.8.9", "{}", "TestContract", {})


def test_deploy_nft(mocked_wallet_provider, mock_wallet):
    """Test deploy_nft method."""
    name = "Test NFT"
    symbol = "TNFT"
    base_uri = "https://example.com/metadata/"

    result = mocked_wallet_provider.deploy_nft(name, symbol, base_uri)

    assert result is not None
    mock_wallet.deploy_nft.assert_called_once_with(name=name, symbol=symbol, base_uri=base_uri)


def test_deploy_nft_without_wallet(mocked_wallet_provider):
    """Test deploy_nft method when wallet is not initialized."""
    mocked_wallet_provider._wallet = None
    with pytest.raises(Exception, match="Wallet not initialized"):
        mocked_wallet_provider.deploy_nft("Test", "TEST", "https://example.com/")


def test_deploy_nft_failure(mocked_wallet_provider, mock_wallet):
    """Test deploy_nft method when deployment fails."""
    mock_wallet.deploy_nft.side_effect = Exception("NFT deployment failed")

    with pytest.raises(Exception, match="Failed to deploy NFT"):
        mocked_wallet_provider.deploy_nft("Test", "TEST", "https://example.com/")


def test_deploy_token(mocked_wallet_provider, mock_wallet):
    """Test deploy_token method."""
    name = "Test Token"
    symbol = "TT"
    total_supply = "1000000"

    result = mocked_wallet_provider.deploy_token(name, symbol, total_supply)

    assert result is not None
    mock_wallet.deploy_token.assert_called_once_with(
        name=name, symbol=symbol, total_supply=total_supply
    )


def test_deploy_token_without_wallet(mocked_wallet_provider):
    """Test deploy_token method when wallet is not initialized."""
    mocked_wallet_provider._wallet = None
    with pytest.raises(Exception, match="Wallet not initialized"):
        mocked_wallet_provider.deploy_token("Test", "TEST", "1000000")


def test_deploy_token_failure(mocked_wallet_provider, mock_wallet):
    """Test deploy_token method when deployment fails."""
    mock_wallet.deploy_token.side_effect = Exception("Token deployment failed")

    with pytest.raises(Exception, match="Failed to deploy token"):
        mocked_wallet_provider.deploy_token("Test", "TEST", "1000000")
