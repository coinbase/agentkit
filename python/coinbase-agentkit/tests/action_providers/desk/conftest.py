"""Test fixtures for DESK action provider tests."""

import pytest

MOCK_PRIVATE_KEY = "0x1234567890123456789012345678901234567890123456789012345678901234"
MOCK_SUB_ACCOUNT_ID = 1
MOCK_RPC_URL = "https://mainnet.infura.io/v3/123"


@pytest.fixture
def mock_private_key():
    """Return mock private key."""
    return MOCK_PRIVATE_KEY


@pytest.fixture
def mock_sub_account_id():
    """Return mock sub account id."""
    return MOCK_SUB_ACCOUNT_ID


@pytest.fixture
def mock_rpc_url():
    """Return mock rpc url."""
    return MOCK_RPC_URL
