"""tests for smart wallet provider initialization."""

from unittest.mock import ANY, Mock, patch

import pytest
from pydantic import ValidationError

from coinbase_agentkit.wallet_providers.smart_wallet_provider import (
    SmartWalletProvider,
    SmartWalletProviderConfig,
)

from .conftest import (
    MOCK_ADDRESS,
    MOCK_API_KEY_NAME,
    MOCK_API_KEY_PRIVATE_KEY,
    MOCK_CHAIN_ID,
    MOCK_NETWORK_ID,
    MOCK_RPC_URL,
)

# =========================================================
# initialization tests
# =========================================================


def test_init_with_api_keys(mock_cdp, mock_signer, mock_smart_wallet):
    """Test initialization with API keys."""
    with (
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.SmartWallet"
        ) as mock_smart_wallet_class,
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.NETWORK_ID_TO_CHAIN",
            {
                MOCK_NETWORK_ID: Mock(
                    id=MOCK_CHAIN_ID, rpc_urls={"default": Mock(http=[MOCK_RPC_URL])}
                )
            },
        ),
    ):
        mock_smart_wallet_class.create.return_value = mock_smart_wallet

        config = SmartWalletProviderConfig(
            network_id=MOCK_NETWORK_ID,
            signer=mock_signer,
            cdp_api_key_name=MOCK_API_KEY_NAME,
            cdp_api_key_private_key=MOCK_API_KEY_PRIVATE_KEY,
        )

        provider = SmartWalletProvider(config)

        mock_cdp.configure.assert_called_once_with(
            api_key_name=MOCK_API_KEY_NAME,
            private_key=MOCK_API_KEY_PRIVATE_KEY,
            source="agentkit",
            source_version=ANY,
        )

        mock_smart_wallet_class.create.assert_called_once_with(mock_signer)
        assert hasattr(mock_smart_wallet, "use_network_kwargs")
        assert mock_smart_wallet.use_network_kwargs.get("paymaster_url") is None
        assert mock_smart_wallet.use_network_kwargs.get("chain_id") == int(MOCK_CHAIN_ID)
        assert provider.get_address() == MOCK_ADDRESS


def test_init_without_api_keys(mock_cdp, mock_signer, mock_smart_wallet):
    """Test initialization without API keys."""
    with (
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.SmartWallet"
        ) as mock_smart_wallet_class,
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.NETWORK_ID_TO_CHAIN",
            {
                MOCK_NETWORK_ID: Mock(
                    id=MOCK_CHAIN_ID, rpc_urls={"default": Mock(http=[MOCK_RPC_URL])}
                )
            },
        ),
    ):
        mock_smart_wallet_class.create.return_value = mock_smart_wallet

        config = SmartWalletProviderConfig(network_id=MOCK_NETWORK_ID, signer=mock_signer)

        provider = SmartWalletProvider(config)

        mock_cdp.configure_from_json.assert_called_once()
        mock_smart_wallet_class.create.assert_called_once_with(mock_signer)
        assert provider.get_address() == MOCK_ADDRESS


def test_init_with_env_vars(mock_cdp, mock_signer, mock_smart_wallet):
    """Test initialization using environment variables."""
    mock_env_vars = {
        "CDP_API_KEY_NAME": "env_api_key_name",
        "CDP_API_KEY_PRIVATE_KEY": "env_api_key_private_key",
        "NETWORK_ID": MOCK_NETWORK_ID,
        "CDP_PAYMASTER_URL": "https://env-paymaster.example.com",
    }

    with (
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.SmartWallet"
        ) as mock_smart_wallet_class,
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.NETWORK_ID_TO_CHAIN",
            {
                MOCK_NETWORK_ID: Mock(
                    id=MOCK_CHAIN_ID, rpc_urls={"default": Mock(http=[MOCK_RPC_URL])}
                )
            },
        ),
        patch.dict("os.environ", mock_env_vars, clear=True),
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.Cdp.configure_from_json"
        ) as mock_configure_from_json,
    ):
        mock_smart_wallet_class.create.return_value = mock_smart_wallet

        config = SmartWalletProviderConfig(signer=mock_signer)
        provider = SmartWalletProvider(config)

        mock_configure_from_json.assert_called_once()

        assert provider._network_id == "base-sepolia"

        assert hasattr(mock_smart_wallet, "use_network_kwargs")
        assert mock_smart_wallet.use_network_kwargs.get("chain_id") == int(MOCK_CHAIN_ID)


def test_init_with_existing_wallet(mock_cdp, mock_signer, mock_smart_wallet):
    """Test initialization with existing smart wallet address."""
    with (
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.to_smart_wallet"
        ) as mock_to_smart_wallet,
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.NETWORK_ID_TO_CHAIN",
            {
                MOCK_NETWORK_ID: Mock(
                    id=MOCK_CHAIN_ID, rpc_urls={"default": Mock(http=[MOCK_RPC_URL])}
                )
            },
        ),
    ):
        mock_to_smart_wallet.return_value = mock_smart_wallet

        config = SmartWalletProviderConfig(
            network_id=MOCK_NETWORK_ID, signer=mock_signer, smart_wallet_address=MOCK_ADDRESS
        )

        provider = SmartWalletProvider(config)

        mock_to_smart_wallet.assert_called_once_with(
            signer=mock_signer, smart_wallet_address=MOCK_ADDRESS
        )
        assert provider.get_address() == MOCK_ADDRESS


def test_init_with_invalid_wallet_address(mock_cdp, mock_signer):
    """Test initialization with invalid wallet address format."""
    invalid_address = "not-a-valid-address"

    with (
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.NETWORK_ID_TO_CHAIN",
            {
                MOCK_NETWORK_ID: Mock(
                    id=MOCK_CHAIN_ID, rpc_urls={"default": Mock(http=[MOCK_RPC_URL])}
                )
            },
        ),
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.to_smart_wallet",
            side_effect=ValueError("Invalid address format"),
        ),
        pytest.raises(ValueError, match="Invalid address format"),
    ):
        config = SmartWalletProviderConfig(
            network_id=MOCK_NETWORK_ID, signer=mock_signer, smart_wallet_address=invalid_address
        )

        SmartWalletProvider(config)


def test_init_with_paymaster_url(mock_cdp, mock_signer, mock_smart_wallet):
    """Test initialization with paymaster URL."""
    paymaster_url = "https://paymaster.example.com"

    with (
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.SmartWallet"
        ) as mock_smart_wallet_class,
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.NETWORK_ID_TO_CHAIN",
            {
                MOCK_NETWORK_ID: Mock(
                    id=MOCK_CHAIN_ID, rpc_urls={"default": Mock(http=[MOCK_RPC_URL])}
                )
            },
        ),
    ):
        mock_smart_wallet_class.create.return_value = mock_smart_wallet

        config = SmartWalletProviderConfig(
            network_id=MOCK_NETWORK_ID, signer=mock_signer, paymaster_url=paymaster_url
        )

        SmartWalletProvider(config)

        assert hasattr(mock_smart_wallet, "use_network_kwargs")
        call_args = mock_smart_wallet.use_network_kwargs
        assert call_args.get("paymaster_url") == paymaster_url


def test_init_with_custom_rpc_url(mock_cdp, mock_signer, mock_smart_wallet):
    """Test initialization with custom RPC URL."""
    with (
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.SmartWallet"
        ) as mock_smart_wallet_class,
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.NETWORK_ID_TO_CHAIN",
            {
                MOCK_NETWORK_ID: Mock(
                    id=MOCK_CHAIN_ID, rpc_urls={"default": Mock(http=[MOCK_RPC_URL])}
                )
            },
        ),
        patch("coinbase_agentkit.wallet_providers.smart_wallet_provider.Web3") as mock_web3_class,
    ):
        mock_smart_wallet_class.create.return_value = mock_smart_wallet
        mock_http_provider = Mock()
        mock_web3_class.HTTPProvider.return_value = mock_http_provider
        mock_web3_instance = Mock()
        mock_web3_class.return_value = mock_web3_instance

        config = SmartWalletProviderConfig(
            network_id=MOCK_NETWORK_ID,
            signer=mock_signer,
        )

        SmartWalletProvider(config)

        mock_web3_class.HTTPProvider.assert_called_once_with(MOCK_RPC_URL)

        assert hasattr(mock_smart_wallet, "use_network_kwargs")
        assert mock_smart_wallet.use_network_kwargs.get("chain_id") == int(MOCK_CHAIN_ID)
        assert mock_smart_wallet.use_network_kwargs.get("paymaster_url") is None


def test_init_with_all_options(mock_cdp, mock_signer, mock_smart_wallet):
    """Test initialization with all possible options."""
    paymaster_url = "https://paymaster.example.com"

    with (
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.SmartWallet"
        ) as mock_smart_wallet_class,
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.NETWORK_ID_TO_CHAIN",
            {
                MOCK_NETWORK_ID: Mock(
                    id=MOCK_CHAIN_ID, rpc_urls={"default": Mock(http=[MOCK_RPC_URL])}
                )
            },
        ),
        patch("coinbase_agentkit.wallet_providers.smart_wallet_provider.Web3") as mock_web3_class,
    ):
        mock_smart_wallet_class.create.return_value = mock_smart_wallet
        mock_http_provider = Mock()
        mock_web3_class.HTTPProvider.return_value = mock_http_provider
        mock_web3_instance = Mock()
        mock_web3_class.return_value = mock_web3_instance

        config = SmartWalletProviderConfig(
            network_id=MOCK_NETWORK_ID,
            signer=mock_signer,
            cdp_api_key_name=MOCK_API_KEY_NAME,
            cdp_api_key_private_key=MOCK_API_KEY_PRIVATE_KEY,
            paymaster_url=paymaster_url,
        )

        SmartWalletProvider(config)

        mock_cdp.configure.assert_called_once_with(
            api_key_name=MOCK_API_KEY_NAME,
            private_key=MOCK_API_KEY_PRIVATE_KEY,
            source="agentkit",
            source_version=ANY,
        )

        mock_web3_class.HTTPProvider.assert_called_once_with(MOCK_RPC_URL)

        call_args = mock_smart_wallet.use_network_kwargs
        assert call_args.get("paymaster_url") == paymaster_url
        assert call_args.get("chain_id") == int(MOCK_CHAIN_ID)


def test_init_smart_wallet_creation_failure(mock_cdp, mock_signer):
    """Test initialization when smart wallet creation fails."""
    with (
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.SmartWallet"
        ) as mock_smart_wallet_class,
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.NETWORK_ID_TO_CHAIN",
            {
                MOCK_NETWORK_ID: Mock(
                    id=MOCK_CHAIN_ID, rpc_urls={"default": Mock(http=[MOCK_RPC_URL])}
                )
            },
        ),
        pytest.raises(Exception, match="Failed to create smart wallet"),
    ):
        mock_smart_wallet_class.create.side_effect = Exception("Failed to create smart wallet")

        config = SmartWalletProviderConfig(network_id=MOCK_NETWORK_ID, signer=mock_signer)

        SmartWalletProvider(config)


def test_init_with_invalid_network_id(mock_cdp, mock_signer):
    """Test initialization with invalid network ID."""
    invalid_network_id = "invalid-network"

    with (
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.NETWORK_ID_TO_CHAIN",
            {
                MOCK_NETWORK_ID: Mock(
                    id=MOCK_CHAIN_ID, rpc_urls={"default": Mock(http=[MOCK_RPC_URL])}
                )
            },
        ),
        pytest.raises(KeyError, match=invalid_network_id),
    ):
        config = SmartWalletProviderConfig(network_id=invalid_network_id, signer=mock_signer)
        SmartWalletProvider(config)


def test_init_with_cdp_error(mock_cdp, mock_signer):
    """Test initialization when CDP configuration fails."""
    error_message = "CDP configuration failed"

    with (
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.Cdp.configure_from_json",
            side_effect=Exception(error_message),
        ),
        pytest.raises(Exception, match=error_message),
    ):
        config = SmartWalletProviderConfig(network_id=MOCK_NETWORK_ID, signer=mock_signer)
        SmartWalletProvider(config)


def test_init_without_signer(mock_cdp):
    """Test initialization without signer (should fail)."""
    with pytest.raises(ValidationError) as excinfo:
        SmartWalletProviderConfig(network_id=MOCK_NETWORK_ID)

    error_str = str(excinfo.value)
    assert "signer" in error_str
    assert "Field required" in error_str


def test_init_with_network_error(mock_cdp, mock_signer, mock_smart_wallet):
    """Test initialization when network configuration fails."""
    with (
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.SmartWallet"
        ) as mock_smart_wallet_class,
        patch(
            "coinbase_agentkit.wallet_providers.smart_wallet_provider.NETWORK_ID_TO_CHAIN",
            {
                MOCK_NETWORK_ID: Mock(
                    id=MOCK_CHAIN_ID, rpc_urls={"default": Mock(http=[MOCK_RPC_URL])}
                )
            },
        ),
        pytest.raises(Exception, match="Failed to configure network"),
    ):
        mock_smart_wallet_class.create.return_value = mock_smart_wallet
        mock_smart_wallet.use_network = Mock(side_effect=Exception("Failed to configure network"))

        config = SmartWalletProviderConfig(network_id=MOCK_NETWORK_ID, signer=mock_signer)

        SmartWalletProvider(config)
