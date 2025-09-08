"""Common test fixtures for CDP Solana Wallet Provider tests."""

from unittest.mock import AsyncMock, Mock, patch

import pytest

from coinbase_agentkit.wallet_providers.cdp_solana_wallet_provider import (
    CdpSolanaWalletProvider,
    CdpSolanaWalletProviderConfig,
)

# =========================================================
# test constants
# =========================================================

# mock API key constants
MOCK_API_KEY_ID = "test_api_key_id"
MOCK_API_KEY_SECRET = "test_api_key_secret"
MOCK_WALLET_SECRET = "test_wallet_secret"

# mock address and network constants
MOCK_ADDRESS = "7dxUFnmrtnurJQPUJkVi7XU8c7A5rr8J5BkZNj9jQGke"
MOCK_NETWORK_ID = "solana-devnet"

# mock transaction constants
MOCK_TRANSACTION_SIGNATURE = (
    "3qN5YnhVNK7FGGxPZbPwGvYJKFMZcF8xKRQV4k7xBwj1jZgBBQYFJHGJQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ"
)
MOCK_ADDRESS_TO = "BYVwqbqr3J7g6LnRmt7dGhF6pJxhJfLnVCyH3r5jKw5c"

# mock SOL values (in lamports)
MOCK_ONE_SOL_LAMPORTS = 1000000000  # 1 SOL = 10^9 lamports
MOCK_BALANCE_LAMPORTS = 2500000000  # 2.5 SOL

# mock signature constants
MOCK_SIGNATURE = (
    "5qN5YnhVNK7FGGxPZbPwGvYJKFMZcF8xKRQV4k7xBwj1jZgBBQYFJHGJQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQ"
)

# =========================================================
# test fixtures
# =========================================================


@pytest.fixture
def mock_cdp_client():
    """Create a mock for CDP Client with proper async handling."""
    with patch(
        "coinbase_agentkit.wallet_providers.cdp_solana_wallet_provider.CdpClient", autospec=True
    ) as mock_client_class:
        # Create a properly configured AsyncMock for the client
        mock_instance = AsyncMock()

        # Set required client properties
        mock_instance.api_key_id = MOCK_API_KEY_ID
        mock_instance.api_key_secret = MOCK_API_KEY_SECRET
        mock_instance.wallet_secret = MOCK_WALLET_SECRET

        # Configure async context manager behavior
        mock_instance.__aenter__.return_value = mock_instance
        mock_instance.__aexit__.return_value = None

        # Create Solana sub-mock with its methods
        mock_solana = AsyncMock()
        mock_account = Mock(address=MOCK_ADDRESS)
        mock_solana.create_account.return_value = mock_account
        mock_solana.get_account.return_value = mock_account
        mock_solana.sign_message.return_value = MOCK_SIGNATURE

        # Create mock transaction
        mock_transaction = Mock(signature=MOCK_TRANSACTION_SIGNATURE)
        mock_account.transfer.return_value = mock_transaction

        # Attach Solana mock to client
        mock_instance.solana = mock_solana

        # Make close() async
        mock_instance.close = AsyncMock()

        # Make the class constructor return our mock
        mock_client_class.return_value = mock_instance

        yield mock_instance


@pytest.fixture
def mock_solana_client():
    """Create a mock SolanaClient instance."""
    with patch(
        "coinbase_agentkit.wallet_providers.cdp_solana_wallet_provider.SolanaClient"
    ) as mock_client:
        mock_client_instance = Mock()
        mock_client.return_value = mock_client_instance

        # Mock balance response
        mock_balance_response = Mock(value=MOCK_BALANCE_LAMPORTS)
        mock_client_instance.get_balance.return_value = mock_balance_response

        yield mock_client


@pytest.fixture
def mock_public_key():
    """Create a mock PublicKey."""
    with patch(
        "coinbase_agentkit.wallet_providers.cdp_solana_wallet_provider.PublicKey"
    ) as mock_pubkey:
        mock_pubkey.from_string.return_value = Mock()
        yield mock_pubkey


@pytest.fixture
def mocked_wallet_provider(mock_cdp_client, mock_solana_client, mock_public_key):
    """Create a mocked wallet provider instance."""
    # Create the configuration
    config = CdpSolanaWalletProviderConfig(
        api_key_id=MOCK_API_KEY_ID,
        api_key_secret=MOCK_API_KEY_SECRET,
        wallet_secret=MOCK_WALLET_SECRET,
        network_id=MOCK_NETWORK_ID,
    )

    # Patch asyncio.run to return the mock account
    mock_account = Mock(address=MOCK_ADDRESS)
    with patch("asyncio.run", return_value=mock_account):
        provider = CdpSolanaWalletProvider(config)

        yield provider
