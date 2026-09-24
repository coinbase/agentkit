"""Common test fixtures for Nano Wallet Provider tests.

A 64-hex test seed that is never used on mainnet. The test provider uses a
mocked RPC so no actual blocks are signed or submitted to the network.
"""

from decimal import Decimal
from unittest.mock import Mock

import pytest

from coinbase_agentkit.wallet_providers.nano_wallet_provider import (
    NanoWalletProvider,
    NanoWalletProviderConfig,
)

# =========================================================
# test constants
# =========================================================

# A deterministic test seed (all zeros) — never used on a real network.
TEST_SEED = "0" * 64
# Derived address for index 0 of that seed.
DERIVED_ADDR = "nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7"

MOCK_ADDRESS = DERIVED_ADDR
MOCK_RPC_URL = "https://mock.nano.rpc"
MOCK_NETWORK_ID = "nano:mainnet"
MOCK_BALANCE_XNO = Decimal("12.5")
MOCK_TX_HASH = "F9DF18449FECC6F789A94D2B1E3AEEAA25F07A1D6290D83B7230A94243000BB7"
MOCK_TO = "nano_3pdripjhteyymwjnaspc5nd96gyxgcdxcskiwwwoqxttnrncrxi974riid94"

FAKE_RESULT_BALANCE = str(int(MOCK_BALANCE_XNO * (10 ** 30)))
FAKE_RESULT_BALANCE_RAW = int(MOCK_BALANCE_XNO * (10 ** 30))


def _fake_account_info(balance_raw=None, frontier=None, rep=None):
    if balance_raw is None:
        balance_raw = FAKE_RESULT_BALANCE_RAW
    return {
        "frontier": frontier or MOCK_TX_HASH,
        "representative": rep or MOCK_ADDRESS,
        "balance": str(balance_raw),
    }


@pytest.fixture
def wallet_provider():
    """Create a NanoWalletProvider with a seed, mocked RPC and fixed account state."""
    config = NanoWalletProviderConfig(
        address=MOCK_ADDRESS,
        seed=TEST_SEED,
        rpc_url=MOCK_RPC_URL,
    )
    provider = NanoWalletProvider(config)
    # Replace the RPC helper with a Mock controlled by the test.
    provider._rpc = Mock()
    provider._account_info = Mock()
    return provider
