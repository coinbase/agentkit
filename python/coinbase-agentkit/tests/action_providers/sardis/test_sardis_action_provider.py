"""Tests for the Sardis action provider."""

from unittest.mock import Mock, patch

import pytest

from coinbase_agentkit.action_providers.sardis.sardis_action_provider import (
    sardis_action_provider,
)
from coinbase_agentkit.action_providers.sardis.schemas import (
    SardisCheckBalanceSchema,
    SardisCheckPolicySchema,
    SardisListTransactionsSchema,
    SardisPaySchema,
    SardisSetPolicySchema,
)
from coinbase_agentkit.network import Network

MOCK_API_KEY = "sk_test_sardis_mock_key_123"
MOCK_WALLET_ID = "wal_test_mock_wallet_456"


# ---------------------------------------------------------------------------
# Initialization tests
# ---------------------------------------------------------------------------


@pytest.mark.usefixtures("mock_env")
def test_provider_init_with_env_vars():
    """Test provider initialization with environment variables."""
    provider = sardis_action_provider()
    assert provider.api_key == MOCK_API_KEY
    assert provider.wallet_id == MOCK_WALLET_ID


def test_provider_init_with_args():
    """Test provider initialization with explicit arguments."""
    provider = sardis_action_provider(
        api_key="sk_explicit",
        wallet_id="wal_explicit",
        base_url="https://custom.api.com",
    )
    assert provider.api_key == "sk_explicit"
    assert provider.wallet_id == "wal_explicit"
    assert provider.base_url == "https://custom.api.com"


def test_provider_init_missing_api_key():
    """Test provider initialization fails with missing API key."""
    with pytest.raises(ValueError, match="SARDIS_API_KEY is not configured"):
        sardis_action_provider()


def test_provider_init_missing_wallet_id(monkeypatch):
    """Test provider initialization fails with missing wallet ID."""
    monkeypatch.setenv("SARDIS_API_KEY", MOCK_API_KEY)
    with pytest.raises(ValueError, match="SARDIS_WALLET_ID is not configured"):
        sardis_action_provider()


# ---------------------------------------------------------------------------
# Network support tests
# ---------------------------------------------------------------------------


def test_supports_evm_network(mock_provider):
    """Test that EVM networks are supported."""
    evm_network = Network(chain_id="8453", protocol_family="evm", network_id="base-mainnet")
    assert mock_provider.supports_network(evm_network) is True


def test_does_not_support_non_evm_network(mock_provider):
    """Test that non-EVM networks are not supported."""
    sol_network = Network(chain_id="1", protocol_family="solana", network_id="solana-mainnet")
    assert mock_provider.supports_network(sol_network) is False


# ---------------------------------------------------------------------------
# Schema validation tests
# ---------------------------------------------------------------------------


def test_pay_schema_required_fields():
    """Test SardisPaySchema requires to and amount."""
    schema = SardisPaySchema(to="openai.com", amount="25.00")
    assert schema.to == "openai.com"
    assert schema.amount == "25.00"
    assert schema.token == "USDC"
    assert schema.purpose == ""


def test_pay_schema_all_fields():
    """Test SardisPaySchema with all fields."""
    schema = SardisPaySchema(
        to="0xabc", amount="100.00", token="USDT", purpose="API subscription"
    )
    assert schema.token == "USDT"
    assert schema.purpose == "API subscription"


def test_check_balance_schema_defaults():
    """Test SardisCheckBalanceSchema defaults."""
    schema = SardisCheckBalanceSchema()
    assert schema.token == "USDC"
    assert schema.chain == "base"


def test_check_policy_schema():
    """Test SardisCheckPolicySchema validation."""
    schema = SardisCheckPolicySchema(to="merchant.com", amount="50.00")
    assert schema.to == "merchant.com"
    assert schema.token == "USDC"


def test_set_policy_schema():
    """Test SardisSetPolicySchema validation."""
    schema = SardisSetPolicySchema(policy_text="Max $50 per transaction")
    assert schema.policy_text == "Max $50 per transaction"
    assert schema.max_per_tx == ""
    assert schema.max_total == ""


def test_list_transactions_schema_defaults():
    """Test SardisListTransactionsSchema defaults."""
    schema = SardisListTransactionsSchema()
    assert schema.limit == 10


# ---------------------------------------------------------------------------
# Action execution tests
# ---------------------------------------------------------------------------


class TestSardisPay:
    """Tests for the sardis_pay action."""

    @patch("coinbase_agentkit.action_providers.sardis.sardis_action_provider.requests.post")
    def test_pay_success(self, mock_post, mock_provider):
        """Test successful payment execution."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "tx_hash": "0xabc123",
            "explorer_url": "https://basescan.org/tx/0xabc123",
            "status": "submitted",
        }
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        result = mock_provider.sardis_pay({
            "to": "openai.com",
            "amount": "25.00",
        })

        assert "Successfully executed payment" in result
        assert "0xabc123" in result
        # Called twice: once for analytics, once for the actual API call
        assert mock_post.call_count >= 1

    @patch("coinbase_agentkit.action_providers.sardis.sardis_action_provider.requests.post")
    def test_pay_policy_violation(self, mock_post, mock_provider):
        """Test payment rejected by policy."""
        mock_response = Mock()
        mock_response.status_code = 403
        mock_response.json.return_value = {
            "detail": "Policy violation - amount exceeds per-transaction limit"
        }
        mock_response.raise_for_status.side_effect = __import__(
            "requests"
        ).exceptions.HTTPError(response=mock_response)
        mock_post.return_value = mock_response

        result = mock_provider.sardis_pay({
            "to": "openai.com",
            "amount": "99999.00",
        })

        assert "Error executing payment" in result
        assert "Policy violation" in result


class TestSardisCheckBalance:
    """Tests for the sardis_check_balance action."""

    @patch("coinbase_agentkit.action_providers.sardis.sardis_action_provider.requests.get")
    def test_check_balance_success(self, mock_get, mock_provider):
        """Test successful balance check."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "wallet_id": MOCK_WALLET_ID,
            "balance": "1250.00",
            "token": "USDC",
            "chain": "base",
            "address": "0x1234567890abcdef",
        }
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        result = mock_provider.sardis_check_balance({})

        assert "Successfully retrieved wallet balance" in result
        assert "1250.00" in result

    @patch("coinbase_agentkit.action_providers.sardis.sardis_action_provider.requests.get")
    def test_check_balance_error(self, mock_get, mock_provider):
        """Test balance check with API error."""
        mock_response = Mock()
        mock_response.status_code = 401
        mock_response.json.return_value = {"detail": "Unauthorized"}
        mock_response.raise_for_status.side_effect = __import__(
            "requests"
        ).exceptions.HTTPError(response=mock_response)
        mock_get.return_value = mock_response

        result = mock_provider.sardis_check_balance({})

        assert "Error checking balance" in result


class TestSardisCheckPolicy:
    """Tests for the sardis_check_policy action."""

    @patch("coinbase_agentkit.action_providers.sardis.sardis_action_provider.requests.post")
    def test_check_policy_allowed(self, mock_post, mock_provider):
        """Test policy check that passes."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "allowed": True,
            "reason": "OK",
            "policy_id": "pol_abc123",
        }
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        result = mock_provider.sardis_check_policy({
            "to": "openai.com",
            "amount": "25.00",
        })

        assert "Successfully checked payment policy" in result
        assert "allowed" in result

    @patch("coinbase_agentkit.action_providers.sardis.sardis_action_provider.requests.post")
    def test_check_policy_denied(self, mock_post, mock_provider):
        """Test policy check that fails."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "allowed": False,
            "reason": "per_transaction_limit",
            "policy_id": "pol_abc123",
        }
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        result = mock_provider.sardis_check_policy({
            "to": "openai.com",
            "amount": "99999.00",
        })

        assert "Successfully checked payment policy" in result
        assert "allowed" in result


class TestSardisSetPolicy:
    """Tests for the sardis_set_policy action."""

    @patch("coinbase_agentkit.action_providers.sardis.sardis_action_provider.requests.post")
    def test_set_policy_success(self, mock_post, mock_provider):
        """Test successful policy update."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "success": True,
            "wallet_id": MOCK_WALLET_ID,
            "limit_per_tx": 50.0,
            "limit_total": 500.0,
            "policy_text": "Max $50/tx, daily limit $500",
        }
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        result = mock_provider.sardis_set_policy({
            "policy_text": "Max $50 per transaction, daily limit $500",
        })

        assert "Successfully updated spending policy" in result
        assert "50.0" in result


class TestSardisListTransactions:
    """Tests for the sardis_list_transactions action."""

    @patch("coinbase_agentkit.action_providers.sardis.sardis_action_provider.requests.get")
    def test_list_transactions_success(self, mock_get, mock_provider):
        """Test successful transaction listing."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "entries": [
                {
                    "tx_id": "tx_1",
                    "amount": "25.00",
                    "from_wallet": MOCK_WALLET_ID,
                    "to_wallet": "openai.com",
                    "currency": "USDC",
                    "created_at": "2026-03-08T10:00:00Z",
                },
                {
                    "tx_id": "tx_2",
                    "amount": "10.00",
                    "from_wallet": MOCK_WALLET_ID,
                    "to_wallet": "anthropic.com",
                    "currency": "USDC",
                    "created_at": "2026-03-08T09:00:00Z",
                },
            ],
        }
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        result = mock_provider.sardis_list_transactions({})

        assert "Successfully retrieved transaction history" in result
        assert "tx_1" in result
        assert "tx_2" in result

    @patch("coinbase_agentkit.action_providers.sardis.sardis_action_provider.requests.get")
    def test_list_transactions_caps_limit(self, mock_get, mock_provider):
        """Test that limit is capped at 50."""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"entries": []}
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response

        mock_provider.sardis_list_transactions({"limit": 100})

        # Verify the limit was capped to 50
        call_args = mock_get.call_args
        assert call_args[1]["params"]["limit"] == 50
