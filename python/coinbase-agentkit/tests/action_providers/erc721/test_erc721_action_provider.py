"""Tests for ERC721 action provider."""

from unittest.mock import ANY, patch

from eth_typing import HexStr

from coinbase_agentkit.network import Network

from .conftest import MOCK_ADDRESS, MOCK_CONTRACT, MOCK_DESTINATION, MOCK_TOKEN_ID, MOCK_TX_HASH


def test_mint_success(provider, mock_wallet_provider):
    """Test successful NFT minting."""
    mock_wallet = mock_wallet_provider
    mock_wallet.send_transaction.return_value = MOCK_TX_HASH

    with patch("web3.eth.Contract") as mock_contract:
        mock_contract.return_value.encode_abi.return_value = b"encoded_data"

        args = {
            "contract_address": MOCK_CONTRACT,
            "destination": MOCK_DESTINATION,
        }

        response = provider.mint(mock_wallet, args)
        assert response == f"Successfully minted NFT {MOCK_CONTRACT} to {MOCK_DESTINATION}"

        mock_wallet.send_transaction.assert_called_once()
        mock_wallet.wait_for_transaction_receipt.assert_called_once_with(MOCK_TX_HASH)


def test_mint_error(provider, mock_wallet_provider):
    """Test error handling in NFT minting."""
    error_message = "Mint failed"
    mock_wallet = mock_wallet_provider
    mock_wallet.send_transaction.side_effect = Exception(error_message)

    with patch("web3.eth.Contract") as mock_contract:
        mock_contract.return_value.encode_abi.return_value = b"encoded_data"

        args = {
            "contract_address": MOCK_CONTRACT,
            "destination": MOCK_DESTINATION,
        }

        response = provider.mint(mock_wallet, args)
        assert (
            response == f"Error minting NFT {MOCK_CONTRACT} to {MOCK_DESTINATION}: {error_message}"
        )


def test_transfer_success(provider, mock_wallet_provider):
    """Test successful NFT transfer."""
    mock_wallet = mock_wallet_provider
    mock_wallet.send_transaction.return_value = MOCK_TX_HASH

    with patch("web3.eth.Contract") as mock_contract:
        mock_contract.return_value.encode_abi.return_value = b"encoded_data"

        args = {
            "contract_address": MOCK_CONTRACT,
            "destination": MOCK_DESTINATION,
            "token_id": MOCK_TOKEN_ID,
            "from_address": MOCK_ADDRESS,
        }

        response = provider.transfer(mock_wallet, args)
        assert (
            response == f"Successfully transferred NFT {MOCK_CONTRACT} with tokenId "
            f"{MOCK_TOKEN_ID} to {MOCK_DESTINATION}"
        )

        mock_wallet.send_transaction.assert_called_once()
        mock_wallet.wait_for_transaction_receipt.assert_called_once_with(MOCK_TX_HASH)


def test_transfer_error(provider, mock_wallet_provider):
    """Test error handling in NFT transfer."""
    error_message = "Transfer failed"
    mock_wallet = mock_wallet_provider
    mock_wallet.send_transaction.side_effect = Exception(error_message)

    with patch("web3.eth.Contract") as mock_contract:
        mock_contract.return_value.encode_abi.return_value = b"encoded_data"

        args = {
            "contract_address": MOCK_CONTRACT,
            "destination": MOCK_DESTINATION,
            "token_id": MOCK_TOKEN_ID,
            "from_address": MOCK_ADDRESS,
        }

        response = provider.transfer(mock_wallet, args)
        assert (
            response == f"Error transferring NFT {MOCK_CONTRACT} with tokenId "
            f"{MOCK_TOKEN_ID} to {MOCK_DESTINATION}: {error_message}"
        )


def test_get_balance_success(provider, mock_wallet_provider):
    """Test successful NFT balance retrieval."""
    mock_wallet_provider.read_contract.return_value = 1

    args = {
        "contract_address": MOCK_CONTRACT,
        "address": MOCK_ADDRESS,
    }

    response = provider.get_balance(mock_wallet_provider, args)
    assert (
        response == f"Balance of NFTs for contract {MOCK_CONTRACT} at address {MOCK_ADDRESS} is 1"
    )

    mock_wallet_provider.read_contract.assert_called_once_with(
        {
            "address": HexStr(MOCK_CONTRACT),
            "abi": ANY,
            "function_name": "balanceOf",
            "args": [MOCK_ADDRESS],
        }
    )


def test_get_balance_error(provider, mock_wallet_provider):
    """Test error handling in NFT balance retrieval."""
    mock_wallet_provider.read_contract.side_effect = Exception("Balance check failed")

    args = {
        "contract_address": MOCK_CONTRACT,
    }

    response = provider.get_balance(mock_wallet_provider, args)
    assert (
        response == f"Error getting NFT balance for contract {MOCK_CONTRACT}: Balance check failed"
    )


def test_supports_network(provider):
    """Test network support check."""
    assert provider.supports_network(Network(protocol_family="evm", chain_id="1"))
    assert not provider.supports_network(Network(protocol_family="solana"))
