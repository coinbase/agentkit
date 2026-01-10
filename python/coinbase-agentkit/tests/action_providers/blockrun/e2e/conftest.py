"""E2E test fixtures for BlockRun action provider."""

import os

import pytest


@pytest.fixture
def wallet_key():
    """Get wallet key for e2e testing.

    Returns:
        str: Wallet key from environment.

    Skips the test if BLOCKRUN_WALLET_KEY is not set.
    """
    wallet_key = os.environ.get("BLOCKRUN_WALLET_KEY", "")
    if not wallet_key:
        pytest.skip("BLOCKRUN_WALLET_KEY environment variable not set")
    return wallet_key


@pytest.fixture
def e2e_provider(wallet_key):
    """Create a BlockrunActionProvider for e2e testing.

    Args:
        wallet_key: Real wallet key from environment.

    Returns:
        BlockrunActionProvider: Provider configured for real API calls.
    """
    from coinbase_agentkit.action_providers.blockrun.blockrun_action_provider import (
        BlockrunActionProvider,
    )

    return BlockrunActionProvider(wallet_key=wallet_key)
