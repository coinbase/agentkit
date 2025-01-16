from unittest.mock import patch

import pytest

from cdp_agentkit_core.actions.get_balance_nft import (
    GetBalanceNftInput,
    get_balance_nft,
)

MOCK_CONTRACT_ADDRESS = "0xvalidContractAddress"
MOCK_ADDRESS = "0xvalidAddress"
MOCK_TOKEN_IDS = [1, 2, 3]


def test_get_balance_nft_input_model_valid():
    """Test that GetBalanceNftInput accepts valid parameters."""
    input_model = GetBalanceNftInput(
        contract_address=MOCK_CONTRACT_ADDRESS,
        address=MOCK_ADDRESS,
    )

    assert input_model.contract_address == MOCK_CONTRACT_ADDRESS
    assert input_model.address == MOCK_ADDRESS


def test_get_balance_nft_input_model_missing_optional():
    """Test that GetBalanceNftInput works with only required parameters."""
    input_model = GetBalanceNftInput(
        contract_address=MOCK_CONTRACT_ADDRESS,
    )

    assert input_model.contract_address == MOCK_CONTRACT_ADDRESS
    assert input_model.address is None


def test_get_balance_nft_input_model_missing_required():
    """Test that GetBalanceNftInput raises error when required params are missing."""
    with pytest.raises(ValueError):
        GetBalanceNftInput()


def test_get_balance_nft_success(wallet_factory):
    """Test successful NFT balance check."""
    mock_wallet = wallet_factory()
    mock_wallet.network_id = "base-sepolia"
    mock_wallet.default_address.address_id = MOCK_ADDRESS

    with patch("cdp.smart_contract.SmartContract.read", return_value=MOCK_TOKEN_IDS):
        action_response = get_balance_nft(
            mock_wallet,
            MOCK_CONTRACT_ADDRESS,
        )

        expected_response = f"Address {MOCK_ADDRESS} owns {len(MOCK_TOKEN_IDS)} NFTs in contract {MOCK_CONTRACT_ADDRESS}.\nToken IDs: 1, 2, 3"
        assert action_response == expected_response


def test_get_balance_nft_no_tokens(wallet_factory):
    """Test NFT balance check when no tokens are owned."""
    mock_wallet = wallet_factory()
    mock_wallet.network_id = "base-sepolia"
    mock_wallet.default_address.address_id = MOCK_ADDRESS

    with patch("cdp.smart_contract.SmartContract.read", return_value=[]):
        action_response = get_balance_nft(
            mock_wallet,
            MOCK_CONTRACT_ADDRESS,
        )

        expected_response = (
            f"Address {MOCK_ADDRESS} owns no NFTs in contract {MOCK_CONTRACT_ADDRESS}"
        )
        assert action_response == expected_response


def test_get_balance_nft_with_address(wallet_factory):
    """Test NFT balance check with specific address."""
    mock_wallet = wallet_factory()
    mock_wallet.network_id = "base-sepolia"
    custom_address = "0xcustomAddress"

    with patch("cdp.smart_contract.SmartContract.read", return_value=MOCK_TOKEN_IDS):
        action_response = get_balance_nft(
            mock_wallet,
            MOCK_CONTRACT_ADDRESS,
            custom_address,
        )

        expected_response = f"Address {custom_address} owns {len(MOCK_TOKEN_IDS)} NFTs in contract {MOCK_CONTRACT_ADDRESS}.\nToken IDs: 1, 2, 3"
        assert action_response == expected_response


def test_get_balance_nft_api_error(wallet_factory):
    """Test NFT balance check when API error occurs."""
    mock_wallet = wallet_factory()
    mock_wallet.network_id = "base-sepolia"
    mock_wallet.default_address.address_id = MOCK_ADDRESS

    with patch("cdp.smart_contract.SmartContract.read", side_effect=Exception("API error")):
        action_response = get_balance_nft(
            mock_wallet,
            MOCK_CONTRACT_ADDRESS,
        )

        expected_response = f"Error getting NFT balance for address {MOCK_ADDRESS} in contract {MOCK_CONTRACT_ADDRESS}: API error"
        assert action_response == expected_response
