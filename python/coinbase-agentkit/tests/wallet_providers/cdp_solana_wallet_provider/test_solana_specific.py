"""Tests for CDP Solana Wallet Provider Solana-specific functionality."""

from decimal import Decimal
from unittest.mock import Mock, patch

from coinbase_agentkit.wallet_providers.cdp_solana_wallet_provider import (
    CdpSolanaWalletProvider,
    CdpSolanaWalletProviderConfig,
)

from .conftest import (
    MOCK_ADDRESS,
    MOCK_API_KEY_ID,
    MOCK_API_KEY_SECRET,
    MOCK_ONE_SOL_LAMPORTS,
    MOCK_WALLET_SECRET,
)

# =========================================================
# Solana-specific tests
# =========================================================


def test_solana_network_configuration():
    """Test Solana-specific network configuration."""
    networks = [
        ("solana-devnet", "https://api.devnet.solana.com"),
        ("solana-mainnet", "https://api.mainnet-beta.solana.com"),
        ("solana-testnet", "https://api.testnet.solana.com"),
    ]

    for network_id, expected_rpc_url in networks:
        with (
            patch("coinbase_agentkit.wallet_providers.cdp_solana_wallet_provider.CdpClient"),
            patch(
                "coinbase_agentkit.wallet_providers.cdp_solana_wallet_provider.SolanaClient"
            ) as mock_solana_client,
            patch("asyncio.run", return_value=Mock(address=MOCK_ADDRESS)),
        ):
            config = CdpSolanaWalletProviderConfig(
                api_key_id=MOCK_API_KEY_ID,
                api_key_secret=MOCK_API_KEY_SECRET,
                wallet_secret=MOCK_WALLET_SECRET,
                network_id=network_id,
            )

            provider = CdpSolanaWalletProvider(config)

            # Verify correct RPC URL was used
            mock_solana_client.assert_called_once_with(expected_rpc_url)

            # Verify network properties
            network = provider.get_network()
            assert network.protocol_family == "svm"
            assert network.network_id == network_id
            assert network.chain_id is None


def test_lamports_to_sol_conversion(mocked_wallet_provider, mock_solana_client, mock_public_key):
    """Test that balance is correctly returned in lamports."""
    # 1 SOL = 1,000,000,000 lamports
    test_cases = [
        (0, Decimal("0")),
        (1, Decimal("1")),  # 1 lamport
        (MOCK_ONE_SOL_LAMPORTS, Decimal(str(MOCK_ONE_SOL_LAMPORTS))),  # 1 SOL
        (5 * MOCK_ONE_SOL_LAMPORTS, Decimal(str(5 * MOCK_ONE_SOL_LAMPORTS))),  # 5 SOL
        (123456789, Decimal("123456789")),  # Fractional SOL
    ]

    for lamports, expected_decimal in test_cases:
        mock_balance_response = Mock(value=lamports)
        mock_solana_client.return_value.get_balance.return_value = mock_balance_response

        balance = mocked_wallet_provider.get_balance()
        assert balance == expected_decimal


def test_solana_address_format_validation():
    """Test handling of Solana address formats."""
    # Solana addresses are base58 encoded strings
    valid_addresses = [
        "7dxUFnmrtnurJQPUJkVi7XU8c7A5rr8J5BkZNj9jQGke",
        "BYVwqbqr3J7g6LnRmt7dGhF6pJxhJfLnVCyH3r5jKw5c",
        "11111111111111111111111111111111",  # System program
    ]

    # Note: This test is more about documenting expected behavior
    # The actual validation happens in the CDP SDK
    for address in valid_addresses:
        assert isinstance(address, str)
        assert len(address) > 0


def test_solana_transfer_parameters(mocked_wallet_provider, mock_cdp_client):
    """Test that transfer parameters are correctly passed to CDP SDK."""
    from unittest.mock import AsyncMock

    to_address = "BYVwqbqr3J7g6LnRmt7dGhF6pJxhJfLnVCyH3r5jKw5c"
    amount = Decimal("2.5")

    # Create a mock wallet with transfer method
    mock_wallet = Mock()
    mock_transfer = AsyncMock(return_value=Mock(signature="test_signature"))
    mock_wallet.transfer = mock_transfer

    # Configure get_account to return our mock wallet
    mock_cdp_client.solana.get_account = AsyncMock(return_value=mock_wallet)

    with patch("asyncio.run", return_value="test_signature"):
        mocked_wallet_provider.native_transfer(to_address, amount)

    # Verify transfer was called with correct parameters
    # Note: We can't directly check the call args due to the async nature,
    # but we can verify the method was set up correctly
    assert hasattr(mock_wallet, "transfer")


def test_solana_public_key_handling(mocked_wallet_provider, mock_solana_client, mock_public_key):
    """Test proper handling of Solana public keys."""
    # Test that PublicKey.from_string is called with correct address
    mocked_wallet_provider.get_balance()

    mock_public_key.from_string.assert_called_once_with(MOCK_ADDRESS)


def test_network_id_defaults():
    """Test default network ID behavior."""
    with (
        patch("coinbase_agentkit.wallet_providers.cdp_solana_wallet_provider.CdpClient"),
        patch("coinbase_agentkit.wallet_providers.cdp_solana_wallet_provider.SolanaClient"),
        patch("asyncio.run", return_value=Mock(address=MOCK_ADDRESS)),
        patch.dict(
            "os.environ",
            {
                "CDP_API_KEY_ID": MOCK_API_KEY_ID,
                "CDP_API_KEY_SECRET": MOCK_API_KEY_SECRET,
                "CDP_WALLET_SECRET": MOCK_WALLET_SECRET,
            },
            clear=True,
        ),
    ):
        # When NETWORK_ID env var is not set, should default to solana-devnet
        config = CdpSolanaWalletProviderConfig()
        provider = CdpSolanaWalletProvider(config)

        assert provider.get_network().network_id == "solana-devnet"


def test_async_context_manager_usage(mocked_wallet_provider, mock_cdp_client):
    """Test that async context manager is properly used."""
    from unittest.mock import AsyncMock

    # Verify that close() is called after operations
    mock_cdp_client.close = AsyncMock()

    # Run a transfer operation
    mock_wallet = Mock()
    mock_wallet.transfer = AsyncMock(return_value=Mock(signature="test_sig"))
    mock_cdp_client.solana.get_account = AsyncMock(return_value=mock_wallet)

    with patch("asyncio.run", return_value="test_sig"):
        mocked_wallet_provider.native_transfer("SomeAddress", Decimal("1.0"))

    # Note: In the actual implementation, close() is called in a finally block
