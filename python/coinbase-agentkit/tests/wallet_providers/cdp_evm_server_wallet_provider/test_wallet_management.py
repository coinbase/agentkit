"""Tests for CDP Wallet Provider wallet management operations."""

import os
from unittest.mock import patch

import pytest

from coinbase_agentkit.wallet_providers.cdp_evm_server_wallet_provider import (
    CdpEvmServerWalletProvider,
    CdpEvmServerWalletProviderConfig,
)

from .conftest import MOCK_API_KEY_ID, MOCK_API_KEY_SECRET, MOCK_WALLET_SECRET

# =========================================================
# wallet management
# =========================================================


def test_get_client(mocked_wallet_provider):
    """Test get_client method."""
    # Verify the wallet provider has the correct credentials
    assert mocked_wallet_provider._api_key_id == MOCK_API_KEY_ID
    assert mocked_wallet_provider._api_key_secret == MOCK_API_KEY_SECRET
    assert mocked_wallet_provider._wallet_secret == MOCK_WALLET_SECRET

    # Get client and verify it's an instance of CdpClient (or a mock of it)
    client = mocked_wallet_provider.get_client()
    assert client is not None


def test_get_client_with_missing_credentials():
    """Test get_client method with missing credentials."""
    with patch.dict(os.environ, {}, clear=True):
        config = CdpEvmServerWalletProviderConfig()

        with pytest.raises(ValueError, match="Missing required environment variables"):
            CdpEvmServerWalletProvider(config)
