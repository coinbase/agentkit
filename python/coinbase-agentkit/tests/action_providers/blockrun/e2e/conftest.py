"""E2E test fixtures for BlockRun action provider."""

import os

import pytest


@pytest.fixture
def cdp_wallet_provider():
    """Create a real CDP wallet provider for e2e testing.

    Requires environment variables:
    - CDP_API_KEY_ID
    - CDP_API_KEY_SECRET
    - CDP_WALLET_SECRET

    The wallet should have USDC on Base mainnet for testing.
    """
    api_key_id = os.environ.get("CDP_API_KEY_ID")
    api_key_secret = os.environ.get("CDP_API_KEY_SECRET")
    wallet_secret = os.environ.get("CDP_WALLET_SECRET")
    wallet_address = os.environ.get("CDP_WALLET_ADDRESS")  # Optional

    if not all([api_key_id, api_key_secret, wallet_secret]):
        pytest.skip(
            "CDP credentials not set. Set CDP_API_KEY_ID, CDP_API_KEY_SECRET, "
            "and CDP_WALLET_SECRET environment variables."
        )

    from coinbase_agentkit.wallet_providers import (
        CdpEvmWalletProvider,
        CdpEvmWalletProviderConfig,
    )

    config = CdpEvmWalletProviderConfig(
        api_key_id=api_key_id,
        api_key_secret=api_key_secret,
        wallet_secret=wallet_secret,
        network_id="base-mainnet",
        address=wallet_address,
    )

    return CdpEvmWalletProvider(config)


@pytest.fixture
def e2e_provider():
    """Create a BlockrunActionProvider for e2e testing.

    Returns:
        BlockrunActionProvider: Provider configured for real API calls.

    """
    from coinbase_agentkit.action_providers.blockrun.blockrun_action_provider import (
        BlockrunActionProvider,
    )

    return BlockrunActionProvider()
