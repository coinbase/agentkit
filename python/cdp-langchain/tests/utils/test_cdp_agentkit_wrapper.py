"""Tests for the CDP Agentkit Wrapper."""

import json
from unittest.mock import Mock, patch

import pytest
from pydantic import ValidationError

from cdp import Cdp, Wallet, WalletData
from cdp_langchain import __version__
from cdp_langchain.constants import CDP_LANGCHAIN_DEFAULT_SOURCE
from cdp_langchain.utils import CdpAgentkitWrapper


@pytest.fixture
def mock_cdp_configure():
    """Fixture for mocked CDP SDK."""
    with patch("cdp.Cdp.configure") as mock_cdp:
        mock_cdp_instance = Mock(spec=Cdp)
        mock_cdp.return_value = mock_cdp_instance
        yield mock_cdp


@pytest.fixture
def mock_wallet_create():
    """Fixture for mocked CDP SDK Wallet creation."""
    with patch("cdp.Wallet.create") as mock_wallet:
        mock_wallet_instance = Mock(spec=Wallet)
        mock_wallet.return_value = mock_wallet_instance
        yield mock_wallet


@pytest.fixture
def mock_wallet_import_data():
    """Fixture for mocked CDP SDK Wallet import data."""
    with patch("cdp.Wallet.import_data") as mock_wallet:
        mock_wallet_instance = Mock(spec=Wallet)
        mock_wallet.return_value = mock_wallet_instance
        yield mock_wallet


@pytest.fixture
def mock_wallet_import_wallet():
    """Fixture for mocked CDP SDK Wallet import mnemonic phrase."""
    with patch("cdp.Wallet.import_wallet") as mock_wallet:
        mock_wallet_instance = Mock(spec=Wallet)
        mock_wallet.return_value = mock_wallet_instance
        yield mock_wallet


@pytest.fixture
def env_vars(monkeypatch: pytest.MonkeyPatch):
    """Fixture to set environment variables."""
    test_vars = {
        "CDP_API_KEY_NAME": "test-cdp-api-key-name",
        "CDP_API_KEY_PRIVATE_KEY": "test-cdp-api-key-private-key",
        "NETWORK_ID": "base-sepolia",
    }
    for key, value in test_vars.items():
        monkeypatch.setenv(key, value)
    return test_vars


def test_initialization_with_env_vars(
    env_vars: dict[str, str], mock_cdp_configure: Mock, mock_wallet_create: Mock
):
    """Test initialization with environment variables."""
    wrapper = CdpAgentkitWrapper()

    assert wrapper.cdp_api_key_name == env_vars["CDP_API_KEY_NAME"]
    assert wrapper.cdp_api_key_private_key == env_vars["CDP_API_KEY_PRIVATE_KEY"]
    assert wrapper.network_id == env_vars["NETWORK_ID"]
    assert wrapper.wallet is not None

    mock_cdp_configure.assert_called_once_with(
        api_key_name=env_vars["CDP_API_KEY_NAME"],
        private_key=env_vars["CDP_API_KEY_PRIVATE_KEY"],
        source=CDP_LANGCHAIN_DEFAULT_SOURCE,
        source_version=__version__,
    )

    mock_wallet_create.assert_called_once_with(network_id=env_vars["NETWORK_ID"])


def test_initialization_with_direct_values(mock_cdp_configure: Mock, mock_wallet_create: Mock):
    """Test initialization with directly provided values."""
    test_values = {
        "cdp_api_key_name": "test-cdp-api-key-name",
        "cdp_api_key_private_key": "test-cdp-api-key-private-key",
        "network_id": "base-sepolia",
    }

    wrapper = CdpAgentkitWrapper(**test_values)

    assert wrapper.cdp_api_key_name == test_values["cdp_api_key_name"]
    assert wrapper.cdp_api_key_private_key == test_values["cdp_api_key_private_key"]
    assert wrapper.network_id == test_values["network_id"]

    mock_cdp_configure.assert_called_once_with(
        api_key_name=test_values["cdp_api_key_name"],
        private_key=test_values["cdp_api_key_private_key"],
        source=CDP_LANGCHAIN_DEFAULT_SOURCE,
        source_version=__version__,
    )

    mock_wallet_create.assert_called_once_with(network_id=test_values["network_id"])


def test_initialization_with_direct_values_and_persisted_wallet(
    mock_cdp_configure: Mock,
    mock_wallet_import_data: Mock,
):
    """Test initialization with directly provided values and persisted wallet."""
    wallet_data = WalletData(wallet_id="test-wallet-id", seed="test-seed")

    test_values = {
        "cdp_api_key_name": "test-cdp-api-key-name",
        "cdp_api_key_private_key": "test-cdp-api-key-private-key",
        "network_id": "base-sepolia",
        "cdp_wallet_data": json.dumps(wallet_data.to_dict()),
    }

    wrapper = CdpAgentkitWrapper(**test_values)

    assert wrapper.cdp_api_key_name == test_values["cdp_api_key_name"]
    assert wrapper.cdp_api_key_private_key == test_values["cdp_api_key_private_key"]
    assert wrapper.network_id == test_values["network_id"]

    mock_cdp_configure.assert_called_once_with(
        api_key_name=test_values["cdp_api_key_name"],
        private_key=test_values["cdp_api_key_private_key"],
        source=CDP_LANGCHAIN_DEFAULT_SOURCE,
        source_version=__version__,
    )

    mock_wallet_import_data.assert_called_once()


def test_initialization_with_direct_values_and_mnemonic_phrase(
    mock_cdp_configure: Mock,
    mock_wallet_import_wallet: Mock,
):
    """Test initialization with directly provided values and persisted wallet."""
    test_values = {
        "cdp_api_key_name": "test-cdp-api-key-name",
        "cdp_api_key_private_key": "test-cdp-api-key-private-key",
        "network_id": "base-sepolia",
        "mnemonic_phrase": "eternal phone creek robot disorder climb thought eternal noodle flat cage bubble liquid sting can",
    }

    wrapper = CdpAgentkitWrapper(**test_values)

    assert wrapper.cdp_api_key_name == test_values["cdp_api_key_name"]
    assert wrapper.cdp_api_key_private_key == test_values["cdp_api_key_private_key"]
    assert wrapper.network_id == test_values["network_id"]

    mock_cdp_configure.assert_called_once_with(
        api_key_name=test_values["cdp_api_key_name"],
        private_key=test_values["cdp_api_key_private_key"],
        source=CDP_LANGCHAIN_DEFAULT_SOURCE,
        source_version=__version__,
    )

    mock_wallet_import_wallet.assert_called_once()


def test_missing_environment_variables(monkeypatch: pytest.MonkeyPatch):
    """Test initialization with missing environment variables."""
    # Clear environment variables
    monkeypatch.delenv("CDP_API_KEY_NAME", raising=False)
    monkeypatch.delenv("CDP_API_KEY_PRIVATE_KEY", raising=False)
    monkeypatch.delenv("NETWORK_ID", raising=False)

    with pytest.raises(ValidationError):
        CdpAgentkitWrapper()


def test_cdp_sdk_import_error():
    """Test handling of missing CDP SDK."""
    with patch.dict("sys.modules", {"cdp": None}):
        test_values = {
            "cdp_api_key_name": "test-cdp-api-key-name",
            "cdp_api_key_private_key": "test-cdp-api-key-private-key",
            "network_id": "base-sepolia",
        }

        with pytest.raises(ImportError) as exc_info:
            CdpAgentkitWrapper(**test_values)

        assert "CDP SDK is not installed" in str(exc_info.value)


def test_run_action_valid_modes(
    env_vars: dict[str, str],
    mock_cdp_configure: Mock,
    mock_wallet_create: Mock,
):
    """Test run method with valid callable."""

    def is_wallet_valid(wallet: Wallet):
        return wallet is not None

    wrapper = CdpAgentkitWrapper()
    result = wrapper.run_action(is_wallet_valid)
    assert result is True


def test_cdp_configuration_error(
    env_vars: dict[str, str], mock_cdp_configure: Mock, mock_wallet_create: Mock
):
    """Test handling of CDP configuration errors."""
    mock_cdp_configure.side_effect = Exception("Configuration error")

    with pytest.raises(Exception) as exc_info:
        CdpAgentkitWrapper()

    assert "Configuration error" in str(exc_info.value)
