"""Tests for CDP Wallet Provider initialization."""

import json
import os
from unittest.mock import ANY, Mock, patch

import pytest
from cdp import Wallet

from coinbase_agentkit.wallet_providers.cdp_wallet_provider import (
    CdpWalletProvider,
    CdpWalletProviderConfig,
)

from .conftest import (
    MOCK_ADDRESS,
    MOCK_API_KEY_NAME,
    MOCK_API_KEY_PRIVATE_KEY,
    MOCK_MNEMONIC,
    MOCK_NETWORK_ID,
    MOCK_WALLET_DATA,
)

# =========================================================
# initialization tests
# =========================================================


def test_init_with_mnemonic(mock_cdp, mock_wallet):
    """Test initialization with mnemonic phrase."""
    with (
        patch("coinbase_agentkit.wallet_providers.cdp_wallet_provider.Wallet") as mock_wallet_class,
        patch("os.getenv", return_value=None),
    ):
        mock_wallet_class.import_wallet.return_value = mock_wallet

        config = CdpWalletProviderConfig(
            mnemonic_phrase=MOCK_MNEMONIC,
            network_id=MOCK_NETWORK_ID,
            api_key_name=None,
            api_key_private_key=None,
        )

        provider = CdpWalletProvider(config)

        mock_cdp.configure_from_json.assert_called_once()
        mock_wallet_class.import_wallet.assert_called_once()
        assert provider.get_address() == MOCK_ADDRESS
        assert provider.get_network().network_id == MOCK_NETWORK_ID


def test_init_with_wallet_data(mock_cdp, mock_wallet):
    """Test initialization with wallet data."""
    with (
        patch("coinbase_agentkit.wallet_providers.cdp_wallet_provider.Wallet") as mock_wallet_class,
        patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.WalletData"
        ) as mock_wallet_data,
        patch("os.getenv", return_value=None),
    ):
        mock_wallet_class.import_data.return_value = mock_wallet
        mock_wallet_data.from_dict.return_value = "mock_wallet_data"

        config = CdpWalletProviderConfig(
            wallet_data=json.dumps(MOCK_WALLET_DATA), api_key_name=None, api_key_private_key=None
        )

        provider = CdpWalletProvider(config)

        mock_cdp.configure_from_json.assert_called_once()
        mock_wallet_class.import_data.assert_called_once_with("mock_wallet_data")
        assert provider.get_address() == MOCK_ADDRESS


def test_init_with_api_keys(mock_cdp, mock_wallet):
    """Test initialization with API keys."""
    with (
        patch("coinbase_agentkit.wallet_providers.cdp_wallet_provider.Wallet") as mock_wallet_class,
        patch("os.getenv", return_value=None),
        patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.NETWORK_ID_TO_CHAIN",
            {
                "base-sepolia": Mock(
                    id="84532", rpc_urls={"default": Mock(http=["https://sepolia.base.org"])}
                )
            },
        ),
    ):
        mock_wallet_class.create.return_value = mock_wallet

        config = CdpWalletProviderConfig(
            api_key_name=MOCK_API_KEY_NAME,
            api_key_private_key=MOCK_API_KEY_PRIVATE_KEY,
            network_id="base-sepolia",
        )

        provider = CdpWalletProvider(config)

        mock_cdp.configure.assert_called_once_with(
            api_key_name=MOCK_API_KEY_NAME,
            private_key=MOCK_API_KEY_PRIVATE_KEY,
            source="agentkit",
            source_version=ANY,
        )
        mock_wallet_class.create.assert_called_once()
        assert provider.get_address() == MOCK_ADDRESS


def test_init_without_config(mock_cdp, mock_wallet):
    """Test initialization without config (should use environment variables)."""
    with (
        patch("coinbase_agentkit.wallet_providers.cdp_wallet_provider.Wallet") as mock_wallet_class,
        patch.dict(
            os.environ,
            {
                "CDP_API_KEY_NAME": MOCK_API_KEY_NAME,
                "CDP_API_KEY_PRIVATE_KEY": MOCK_API_KEY_PRIVATE_KEY,
                "NETWORK_ID": MOCK_NETWORK_ID,
            },
        ),
    ):
        mock_wallet_class.create.return_value = mock_wallet

        provider = CdpWalletProvider()

        mock_cdp.configure.assert_called_once_with(
            api_key_name=MOCK_API_KEY_NAME,
            private_key=MOCK_API_KEY_PRIVATE_KEY,
            source="agentkit",
            source_version=ANY,
        )
        assert provider.get_address() == MOCK_ADDRESS


def test_init_with_default_network(mock_cdp, mock_wallet):
    """Test initialization with default network when no network ID is provided."""
    with (
        patch("coinbase_agentkit.wallet_providers.cdp_wallet_provider.Wallet") as mock_wallet_class,
        patch(
            "os.getenv",
            side_effect=lambda key, default=None: "base-sepolia" if key == "NETWORK_ID" else None,
        ),
        patch.dict(os.environ, {}, clear=True),
        patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.NETWORK_ID_TO_CHAIN",
            {
                "base-sepolia": Mock(
                    id="84532", rpc_urls={"default": Mock(http=["https://sepolia.base.org"])}
                )
            },
        ),
    ):
        mock_wallet = Mock(spec=Wallet)
        mock_wallet.network_id = "base-sepolia"
        mock_wallet.default_address.address_id = MOCK_ADDRESS
        mock_wallet_class.create.return_value = mock_wallet

        config = CdpWalletProviderConfig(
            api_key_name=MOCK_API_KEY_NAME,
            api_key_private_key=MOCK_API_KEY_PRIVATE_KEY,
        )

        provider = CdpWalletProvider(config)

        network = provider.get_network()
        assert network.network_id == "base-sepolia"


def test_import_error(mock_cdp):
    """Test handling of import error."""
    with patch("coinbase_agentkit.wallet_providers.cdp_wallet_provider.Cdp") as cdp_mock:
        error_msg = "Failed to import cdp"
        cdp_mock.configure.side_effect = ImportError(error_msg)
        cdp_mock.configure_from_json.side_effect = ImportError(error_msg)

        config = CdpWalletProviderConfig()

        with pytest.raises(ImportError, match=error_msg):
            CdpWalletProvider(config)


def test_initialization_error(mock_cdp):
    """Test handling of initialization error."""
    with patch(
        "coinbase_agentkit.wallet_providers.cdp_wallet_provider.Wallet.create",
        side_effect=Exception("Failed to create wallet"),
    ):
        config = CdpWalletProviderConfig()

        with pytest.raises(ValueError, match="Failed to initialize CDP wallet"):
            CdpWalletProvider(config)
