"""Tests for CDP Wallet Provider initialization."""

import os
from unittest.mock import patch

import pytest

from coinbase_agentkit.wallet_providers.cdp_evm_server_wallet_provider import (
    CdpEvmServerWalletProvider,
    CdpEvmServerWalletProviderConfig,
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


def test_init_with_config(mock_cdp_client, mock_account):
    """Test initialization with config."""
    with patch("asyncio.run") as mock_run:
        mock_run.return_value = mock_account

        config = CdpEvmServerWalletProviderConfig(
            api_key_id=MOCK_API_KEY_ID,
            api_key_secret=MOCK_API_KEY_SECRET,
            wallet_secret=MOCK_WALLET_SECRET,
            network_id=MOCK_NETWORK_ID,
        )

        provider = CdpEvmServerWalletProvider(config)

        assert provider.get_address() == MOCK_ADDRESS
        assert provider.get_network().network_id == MOCK_NETWORK_ID


def test_init_with_env_vars(mock_cdp_client, mock_account):
    """Test initialization with environment variables."""
    with (
        patch("asyncio.run") as mock_run,
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
        mock_run.return_value = mock_account

        provider = CdpEvmServerWalletProvider(CdpEvmServerWalletProviderConfig())

        assert provider.get_address() == MOCK_ADDRESS
        assert provider.get_network().network_id == MOCK_NETWORK_ID


def test_init_with_default_network(mock_cdp_client, mock_account):
    """Test initialization with default network when no network ID is provided."""
    with (
        patch("asyncio.run") as mock_run,
        patch(
            "os.getenv",
            side_effect=lambda key, default=None: "base-sepolia" if key == "NETWORK_ID" else None,
        ),
        patch.dict(os.environ, {}, clear=True),
    ):
        mock_run.return_value = mock_account

        config = CdpEvmServerWalletProviderConfig(
            api_key_id=MOCK_API_KEY_ID,
            api_key_secret=MOCK_API_KEY_SECRET,
            wallet_secret=MOCK_WALLET_SECRET,
        )

        provider = CdpEvmServerWalletProvider(config)

        network = provider.get_network()
        assert network.network_id == "base-sepolia"


def test_init_with_missing_credentials():
    """Test initialization with missing credentials."""
    with patch.dict(os.environ, {}, clear=True):
        config = CdpEvmServerWalletProviderConfig()

        with pytest.raises(ValueError, match="Missing required environment variables"):
            CdpEvmServerWalletProvider(config)


def test_init_with_invalid_network(mock_cdp_client):
    """Test initialization with invalid network."""
    # Use a known invalid network ID
    with patch("asyncio.run", side_effect=ValueError("Invalid network ID")):
        config = CdpEvmServerWalletProviderConfig(
            api_key_id=MOCK_API_KEY_ID,
            api_key_secret=MOCK_API_KEY_SECRET,
            wallet_secret=MOCK_WALLET_SECRET,
            network_id="invalid-network",
        )

        with pytest.raises(ValueError, match="Failed to initialize CDP wallet"):
            CdpEvmServerWalletProvider(config)


def test_init_with_account_creation_error(mock_cdp_client):
    """Test initialization when account creation fails."""
    with patch("asyncio.run", side_effect=Exception("Failed to create account")):
        config = CdpEvmServerWalletProviderConfig(
            api_key_id=MOCK_API_KEY_ID,
            api_key_secret=MOCK_API_KEY_SECRET,
            wallet_secret=MOCK_WALLET_SECRET,
            network_id=MOCK_NETWORK_ID,
        )

        with pytest.raises(ValueError, match="Failed to initialize CDP wallet"):
            CdpEvmServerWalletProvider(config)
