"""Tests for CDP Solana Wallet Provider initialization."""

import os
from unittest.mock import Mock, patch

import pytest

from coinbase_agentkit.wallet_providers.cdp_solana_wallet_provider import (
    CdpSolanaWalletProvider,
    CdpSolanaWalletProviderConfig,
)

from .conftest import (
    MOCK_ADDRESS,
    MOCK_API_KEY_ID,
    MOCK_API_KEY_SECRET,
    MOCK_NETWORK_ID,
    MOCK_WALLET_SECRET,
)

# =========================================================
# initialization tests
# =========================================================


def test_init_with_config(mock_cdp_client, mock_solana_client, mock_public_key):
    """Test initialization with config."""
    mock_account = Mock(address=MOCK_ADDRESS)
    with patch("asyncio.run", return_value=mock_account):
        config = CdpSolanaWalletProviderConfig(
            api_key_id=MOCK_API_KEY_ID,
            api_key_secret=MOCK_API_KEY_SECRET,
            wallet_secret=MOCK_WALLET_SECRET,
            network_id=MOCK_NETWORK_ID,
        )

        provider = CdpSolanaWalletProvider(config)

        assert provider.get_address() == MOCK_ADDRESS
        assert provider.get_network().network_id == MOCK_NETWORK_ID


def test_init_with_env_vars(mock_cdp_client, mock_solana_client, mock_public_key):
    """Test initialization with environment variables."""
    mock_account = Mock(address=MOCK_ADDRESS)
    with (
        patch("asyncio.run", return_value=mock_account),
        patch.dict(
            os.environ,
            {
                "CDP_API_KEY_ID": MOCK_API_KEY_ID,
                "CDP_API_KEY_SECRET": MOCK_API_KEY_SECRET,
                "CDP_WALLET_SECRET": MOCK_WALLET_SECRET,
                "NETWORK_ID": MOCK_NETWORK_ID,
            },
        ),
    ):
        provider = CdpSolanaWalletProvider(CdpSolanaWalletProviderConfig())

        assert provider.get_address() == MOCK_ADDRESS
        assert provider.get_network().network_id == MOCK_NETWORK_ID


def test_init_with_default_network(mock_cdp_client, mock_solana_client, mock_public_key):
    """Test initialization with default network when no network ID is provided."""
    mock_account = Mock(address=MOCK_ADDRESS)
    with (
        patch("asyncio.run", return_value=mock_account),
        patch(
            "os.getenv",
            side_effect=lambda key, default=None: "solana-devnet" if key == "NETWORK_ID" else None,
        ),
        patch.dict(os.environ, {}, clear=True),
    ):
        config = CdpSolanaWalletProviderConfig(
            api_key_id=MOCK_API_KEY_ID,
            api_key_secret=MOCK_API_KEY_SECRET,
            wallet_secret=MOCK_WALLET_SECRET,
        )

        provider = CdpSolanaWalletProvider(config)

        network = provider.get_network()
        assert network.network_id == "solana-devnet"


def test_init_with_existing_address(mock_cdp_client, mock_solana_client, mock_public_key):
    """Test initialization with an existing wallet address."""
    existing_address = "ExistingWalletAddress1234567890"
    mock_account = Mock(address=existing_address)

    # Mock the async function execution to verify the right path is taken
    async def mock_init_wallet():
        async with mock_cdp_client as cdp:
            # Since we have an address, get_account should be called
            wallet = await cdp.solana.get_account(address=existing_address)
            return wallet

    # Configure the mocks
    mock_cdp_client.solana.get_account.return_value = mock_account

    with patch("asyncio.run") as mock_run:
        # Make asyncio.run call our async function and return the account
        mock_run.side_effect = lambda coro: mock_account

        config = CdpSolanaWalletProviderConfig(
            api_key_id=MOCK_API_KEY_ID,
            api_key_secret=MOCK_API_KEY_SECRET,
            wallet_secret=MOCK_WALLET_SECRET,
            network_id=MOCK_NETWORK_ID,
            address=existing_address,
        )

        provider = CdpSolanaWalletProvider(config)

        assert provider.get_address() == existing_address
        # The asyncio.run was called once during initialization
        assert mock_run.called


def test_init_with_mainnet(mock_cdp_client, mock_solana_client, mock_public_key):
    """Test initialization with mainnet configuration."""
    mock_account = Mock(address=MOCK_ADDRESS)
    with patch("asyncio.run", return_value=mock_account):
        config = CdpSolanaWalletProviderConfig(
            api_key_id=MOCK_API_KEY_ID,
            api_key_secret=MOCK_API_KEY_SECRET,
            wallet_secret=MOCK_WALLET_SECRET,
            network_id="solana-mainnet",
        )

        CdpSolanaWalletProvider(config)

        # Verify mainnet RPC URL was used
        mock_solana_client.assert_called_with("https://api.mainnet-beta.solana.com")


def test_init_with_testnet(mock_cdp_client, mock_solana_client, mock_public_key):
    """Test initialization with testnet configuration."""
    mock_account = Mock(address=MOCK_ADDRESS)
    with patch("asyncio.run", return_value=mock_account):
        config = CdpSolanaWalletProviderConfig(
            api_key_id=MOCK_API_KEY_ID,
            api_key_secret=MOCK_API_KEY_SECRET,
            wallet_secret=MOCK_WALLET_SECRET,
            network_id="solana-testnet",
        )

        CdpSolanaWalletProvider(config)

        # Verify testnet RPC URL was used
        mock_solana_client.assert_called_with("https://api.testnet.solana.com")


def test_init_with_missing_credentials():
    """Test initialization with missing credentials."""
    with patch.dict(os.environ, {}, clear=True):
        config = CdpSolanaWalletProviderConfig()

        with pytest.raises(ValueError, match="Missing required environment variables"):
            CdpSolanaWalletProvider(config)


def test_init_with_cdp_import_error():
    """Test initialization when CDP SDK is not installed."""
    with patch(
        "coinbase_agentkit.wallet_providers.cdp_solana_wallet_provider.CdpClient",
        side_effect=ImportError("CDP SDK not found"),
    ):
        config = CdpSolanaWalletProviderConfig(
            api_key_id=MOCK_API_KEY_ID,
            api_key_secret=MOCK_API_KEY_SECRET,
            wallet_secret=MOCK_WALLET_SECRET,
        )

        with pytest.raises(ImportError, match="Failed to import cdp"):
            CdpSolanaWalletProvider(config)


def test_init_with_account_creation_error(mock_cdp_client, mock_solana_client, mock_public_key):
    """Test initialization when account creation fails."""
    with patch("asyncio.run", side_effect=Exception("Failed to create account")):
        config = CdpSolanaWalletProviderConfig(
            api_key_id=MOCK_API_KEY_ID,
            api_key_secret=MOCK_API_KEY_SECRET,
            wallet_secret=MOCK_WALLET_SECRET,
            network_id=MOCK_NETWORK_ID,
        )

        with pytest.raises(ValueError, match="Failed to initialize CDP Solana wallet"):
            CdpSolanaWalletProvider(config)
