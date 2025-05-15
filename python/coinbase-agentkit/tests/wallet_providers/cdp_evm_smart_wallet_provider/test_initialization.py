"""tests for CDP EVM Smart Wallet provider initialization."""

import os
from unittest.mock import Mock, patch

import pytest
from eth_account.account import Account

from coinbase_agentkit.wallet_providers.cdp_evm_smart_wallet_provider import (
    CdpEvmSmartWalletProvider,
    CdpEvmSmartWalletProviderConfig,
)

from .conftest import (
    MOCK_ADDRESS,
    MOCK_API_KEY_ID,
    MOCK_API_KEY_SECRET,
    MOCK_NETWORK_ID,
    MOCK_PAYMASTER_URL,
    MOCK_WALLET_SECRET,
)

# =========================================================
# initialization tests
# =========================================================


def test_init_with_config(mock_cdp_client, mock_asyncio, mock_network_id_to_chain):
    """Test initialization with full configuration."""
    # Setup the mocks for async operation
    mock_owner = Mock(spec=Account)
    mock_owner.address = "0x123456789012345678901234567890123456789012"

    mock_smart_account = Mock()
    mock_smart_account.address = MOCK_ADDRESS

    async def get_account_mock(*args, **kwargs):
        return mock_owner

    async def get_smart_account_mock(*args, **kwargs):
        return mock_smart_account

    async def create_smart_account_mock(*args, **kwargs):
        return mock_smart_account

    mock_cdp_client.evm.get_account.side_effect = get_account_mock
    mock_cdp_client.evm.get_smart_account.side_effect = get_smart_account_mock
    mock_cdp_client.evm.create_smart_account.side_effect = create_smart_account_mock

    # Test with full configuration
    config = CdpEvmSmartWalletProviderConfig(
        api_key_id=MOCK_API_KEY_ID,
        api_key_secret=MOCK_API_KEY_SECRET,
        wallet_secret=MOCK_WALLET_SECRET,
        network_id=MOCK_NETWORK_ID,
        owner=mock_owner.address,
        address=MOCK_ADDRESS,
        paymaster_url=MOCK_PAYMASTER_URL,
    )

    provider = CdpEvmSmartWalletProvider(config)

    assert provider.get_address() == MOCK_ADDRESS
    assert provider.get_name() == "cdp_evm_smart_wallet_provider"
    assert provider._api_key_id == MOCK_API_KEY_ID
    assert provider._api_key_secret == MOCK_API_KEY_SECRET
    assert provider._wallet_secret == MOCK_WALLET_SECRET
    assert provider._paymaster_url == MOCK_PAYMASTER_URL


def test_init_with_env_vars(mock_cdp_client, mock_asyncio, mock_network_id_to_chain):
    """Test initialization using environment variables."""
    # Setup the mocks for async operation
    mock_owner = Mock(spec=Account)
    mock_owner.address = "0x123456789012345678901234567890123456789012"

    mock_smart_account = Mock()
    mock_smart_account.address = MOCK_ADDRESS

    async def get_account_mock(*args, **kwargs):
        return mock_owner

    async def get_smart_account_mock(*args, **kwargs):
        return mock_smart_account

    async def create_smart_account_mock(*args, **kwargs):
        return mock_smart_account

    mock_cdp_client.evm.get_account.side_effect = get_account_mock
    mock_cdp_client.evm.get_smart_account.side_effect = get_smart_account_mock
    mock_cdp_client.evm.create_smart_account.side_effect = create_smart_account_mock

    # Mock environment variables
    mock_env_vars = {
        "CDP_API_KEY_ID": MOCK_API_KEY_ID,
        "CDP_API_KEY_SECRET": MOCK_API_KEY_SECRET,
        "CDP_WALLET_SECRET": MOCK_WALLET_SECRET,
        "NETWORK_ID": MOCK_NETWORK_ID,
        "OWNER": mock_owner.address,
    }

    with patch.dict(os.environ, mock_env_vars, clear=True):
        config = CdpEvmSmartWalletProviderConfig()
        provider = CdpEvmSmartWalletProvider(config)

        assert provider.get_name() == "cdp_evm_smart_wallet_provider"
        assert provider._api_key_id == MOCK_API_KEY_ID
        assert provider._api_key_secret == MOCK_API_KEY_SECRET
        assert provider._wallet_secret == MOCK_WALLET_SECRET


def test_init_with_private_key_owner(mock_cdp_client, mock_asyncio, mock_network_id_to_chain):
    """Test initialization with private key owner."""
    # Setup the mocks for async operation
    private_key = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    mock_owner = Mock(spec=Account)
    mock_owner.address = "0x123456789012345678901234567890123456789012"

    mock_smart_account = Mock()
    mock_smart_account.address = MOCK_ADDRESS

    with patch(
        "coinbase_agentkit.wallet_providers.cdp_evm_smart_wallet_provider.Account"
    ) as mock_account_class:
        mock_account_class.from_key.return_value = mock_owner

        # Update mock_asyncio.run to return a tuple with the owner and smart_account for initialization
        def run_side_effect(coro):
            if coro.__name__ == "initialize_accounts":
                return (mock_owner, mock_smart_account)
            return None

        mock_asyncio.run.side_effect = run_side_effect

        async def create_smart_account_mock(*args, **kwargs):
            return mock_smart_account

        mock_cdp_client.evm.create_smart_account.side_effect = create_smart_account_mock

        config = CdpEvmSmartWalletProviderConfig(
            api_key_id=MOCK_API_KEY_ID,
            api_key_secret=MOCK_API_KEY_SECRET,
            wallet_secret=MOCK_WALLET_SECRET,
            network_id=MOCK_NETWORK_ID,
            owner=private_key,
        )

        provider = CdpEvmSmartWalletProvider(config)

        # Don't check if from_key was called, since we're mocking asyncio.run
        # We only care that the provider was initialized correctly
        assert provider.get_address() == MOCK_ADDRESS
        assert provider._owner == mock_owner


def test_init_without_required_credentials():
    """Test initialization without required credentials."""
    config = CdpEvmSmartWalletProviderConfig()

    with pytest.raises(ValueError, match="Missing required environment variables"):
        CdpEvmSmartWalletProvider(config)


def test_init_without_owner():
    """Test initialization without owner."""
    config = CdpEvmSmartWalletProviderConfig(
        api_key_id=MOCK_API_KEY_ID,
        api_key_secret=MOCK_API_KEY_SECRET,
        wallet_secret=MOCK_WALLET_SECRET,
    )

    with pytest.raises(
        ValueError, match="Owner private key or CDP server wallet address is required"
    ):
        CdpEvmSmartWalletProvider(config)


def test_init_with_invalid_network_id(mock_cdp_client, mock_asyncio):
    """Test initialization with invalid network ID."""
    invalid_network_id = "invalid-network"

    with pytest.raises(ValueError) as excinfo:
        config = CdpEvmSmartWalletProviderConfig(
            api_key_id=MOCK_API_KEY_ID,
            api_key_secret=MOCK_API_KEY_SECRET,
            wallet_secret=MOCK_WALLET_SECRET,
            network_id=invalid_network_id,
            owner="0x123456789012345678901234567890123456789012",
        )
        CdpEvmSmartWalletProvider(config)

    # Check that the error message contains the invalid network ID
    assert "Failed to initialize CDP smart wallet" in str(excinfo.value)
    assert invalid_network_id in str(excinfo.value.__cause__)
