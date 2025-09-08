"""Tests for CDP Solana Wallet Provider basic methods."""

from decimal import Decimal
from unittest.mock import Mock

import pytest

from coinbase_agentkit.network import Network

from .conftest import MOCK_ADDRESS, MOCK_BALANCE_LAMPORTS, MOCK_NETWORK_ID

# =========================================================
# basic wallet method tests
# =========================================================


def test_get_address(mocked_wallet_provider):
    """Test get_address method."""
    assert mocked_wallet_provider.get_address() == MOCK_ADDRESS


def test_get_balance(mocked_wallet_provider, mock_solana_client, mock_public_key):
    """Test get_balance method."""
    balance = mocked_wallet_provider.get_balance()
    assert balance == Decimal(MOCK_BALANCE_LAMPORTS)
    mock_solana_client.return_value.get_balance.assert_called_once()
    mock_public_key.from_string.assert_called_once_with(MOCK_ADDRESS)


def test_get_balance_zero(mocked_wallet_provider, mock_solana_client, mock_public_key):
    """Test get_balance method when balance is zero."""
    # Mock zero balance response
    mock_balance_response = Mock(value=0)
    mock_solana_client.return_value.get_balance.return_value = mock_balance_response

    balance = mocked_wallet_provider.get_balance()
    assert balance == Decimal(0)


def test_get_balance_with_connection_error(
    mocked_wallet_provider, mock_solana_client, mock_public_key
):
    """Test get_balance method with network connection error."""
    mock_solana_client.return_value.get_balance.side_effect = ConnectionError(
        "Network connection error"
    )

    with pytest.raises(ConnectionError, match="Network connection error"):
        mocked_wallet_provider.get_balance()


def test_get_balance_with_invalid_address(
    mocked_wallet_provider, mock_solana_client, mock_public_key
):
    """Test get_balance method with invalid address format."""
    mock_public_key.from_string.side_effect = ValueError("Invalid base58 string")

    with pytest.raises(ValueError, match="Invalid base58 string"):
        mocked_wallet_provider.get_balance()


def test_get_name(mocked_wallet_provider):
    """Test get_name method."""
    assert mocked_wallet_provider.get_name() == "cdp_solana_wallet_provider"


def test_get_network(mocked_wallet_provider):
    """Test get_network method."""
    network = mocked_wallet_provider.get_network()
    assert isinstance(network, Network)
    assert network.protocol_family == "svm"
    assert network.network_id == MOCK_NETWORK_ID
    assert network.chain_id is None  # Solana doesn't use chain IDs


def test_get_network_different_networks():
    """Test get_network method returns correct network for different configurations."""
    from unittest.mock import Mock, patch

    from coinbase_agentkit.wallet_providers.cdp_solana_wallet_provider import (
        CdpSolanaWalletProvider,
        CdpSolanaWalletProviderConfig,
    )

    networks = [
        ("solana-devnet", "https://api.devnet.solana.com"),
        ("solana-mainnet", "https://api.mainnet-beta.solana.com"),
        ("solana-testnet", "https://api.testnet.solana.com"),
    ]

    for network_id, _ in networks:
        with (
            patch("coinbase_agentkit.wallet_providers.cdp_solana_wallet_provider.CdpClient"),
            patch("coinbase_agentkit.wallet_providers.cdp_solana_wallet_provider.SolanaClient"),
            patch("asyncio.run", return_value=Mock(address=MOCK_ADDRESS)),
        ):
            config = CdpSolanaWalletProviderConfig(
                api_key_id="test_key",
                api_key_secret="test_secret",
                wallet_secret="test_wallet_secret",
                network_id=network_id,
            )

            provider = CdpSolanaWalletProvider(config)
            network = provider.get_network()

            assert network.network_id == network_id
            assert network.protocol_family == "svm"
            assert network.chain_id is None
