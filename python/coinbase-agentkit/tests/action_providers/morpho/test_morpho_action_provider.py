import decimal
from unittest.mock import MagicMock, patch

import pytest

from coinbase_agentkit.action_providers.morpho.morpho_action_provider import morpho_action_provider
from coinbase_agentkit.network import Network

MOCK_VAULT_ADDRESS = "0x1234567890123456789012345678901234567890"
MOCK_TOKEN_ADDRESS = "0x0987654321098765432109876543210987654321"
MOCK_RECEIVER = "0x5555555555555555555555555555555555555555"
MOCK_TX_HASH = "0xabcdef1234567890"
MOCK_DECIMALS = 18


# Deposit Tests
def test_morpho_deposit_success():
    """Test successful morpho deposit with valid parameters."""
    mock_wallet = MagicMock()
    mock_wallet.send_transaction.return_value = MOCK_TX_HASH
    mock_wallet.read_contract.return_value = MOCK_DECIMALS

    with patch(
        "coinbase_agentkit.action_providers.morpho.morpho_action_provider.approve"
    ) as mock_approve:
        mock_approve.return_value = True

        result = morpho_action_provider().deposit(
            mock_wallet,
            {
                "vault_address": MOCK_VAULT_ADDRESS,
                "token_address": MOCK_TOKEN_ADDRESS,
                "assets": "1.0",
                "receiver": MOCK_RECEIVER,
            },
        )

        mock_approve.assert_called_once_with(
            mock_wallet, MOCK_TOKEN_ADDRESS, MOCK_VAULT_ADDRESS, 1000000000000000000
        )

        assert MOCK_TX_HASH in result
        assert "Deposited 1.0" in result
        mock_wallet.send_transaction.assert_called_once()
        mock_wallet.wait_for_transaction_receipt.assert_called_once_with(MOCK_TX_HASH)


def test_morpho_deposit_zero_amount():
    """Test morpho deposit with zero amount."""
    mock_wallet = MagicMock()

    result = morpho_action_provider().deposit(
        mock_wallet,
        {
            "vault_address": MOCK_VAULT_ADDRESS,
            "token_address": MOCK_TOKEN_ADDRESS,
            "assets": "0.0",
            "receiver": MOCK_RECEIVER,
        },
    )

    assert "Error: Assets amount must be greater than 0" in result
    mock_wallet.send_transaction.assert_not_called()


def test_morpho_deposit_negative_amount():
    """Test morpho deposit with negative amount."""
    mock_wallet = MagicMock()

    result = morpho_action_provider().deposit(
        mock_wallet,
        {
            "vault_address": MOCK_VAULT_ADDRESS,
            "token_address": MOCK_TOKEN_ADDRESS,
            "assets": "-1.0",
            "receiver": MOCK_RECEIVER,
        },
    )

    assert "Error: Assets amount must be greater than 0" in result


def test_morpho_deposit_invalid_amount():
    """Test morpho deposit with invalid amount string."""
    mock_wallet = MagicMock()

    with pytest.raises(decimal.InvalidOperation):
        morpho_action_provider().deposit(
            mock_wallet,
            {
                "vault_address": MOCK_VAULT_ADDRESS,
                "token_address": MOCK_TOKEN_ADDRESS,
                "assets": "invalid_amount",
                "receiver": MOCK_RECEIVER,
            },
        )


def test_morpho_deposit_approval_failure():
    """Test morpho deposit when approval fails."""
    mock_wallet = MagicMock()
    mock_wallet.read_contract.return_value = MOCK_DECIMALS

    with patch(
        "coinbase_agentkit.action_providers.morpho.morpho_action_provider.approve"
    ) as mock_approve:
        mock_approve.side_effect = Exception("Approval failed")

        result = morpho_action_provider().deposit(
            mock_wallet,
            {
                "vault_address": MOCK_VAULT_ADDRESS,
                "token_address": MOCK_TOKEN_ADDRESS,
                "assets": "1.0",
                "receiver": MOCK_RECEIVER,
            },
        )

        assert "Error approving Morpho Vault as spender" in result
        mock_wallet.send_transaction.assert_not_called()


def test_morpho_deposit_transaction_failure():
    """Test morpho deposit when transaction fails."""
    mock_wallet = MagicMock()
    mock_wallet.send_transaction.side_effect = Exception("Transaction failed")
    mock_wallet.read_contract.return_value = MOCK_DECIMALS

    with patch(
        "coinbase_agentkit.action_providers.morpho.morpho_action_provider.approve"
    ) as mock_approve:
        mock_approve.return_value = True

        result = morpho_action_provider().deposit(
            mock_wallet,
            {
                "vault_address": MOCK_VAULT_ADDRESS,
                "token_address": MOCK_TOKEN_ADDRESS,
                "assets": "1.0",
                "receiver": MOCK_RECEIVER,
            },
        )

        assert "Error depositing to Morpho Vault" in result


def test_morpho_deposit_non_18_decimals():
    """Test morpho deposit with token that has non-18 decimals (e.g., USDC with 6)."""
    mock_wallet = MagicMock()
    mock_wallet.send_transaction.return_value = MOCK_TX_HASH
    mock_wallet.read_contract.return_value = 6  # USDC has 6 decimals

    with patch(
        "coinbase_agentkit.action_providers.morpho.morpho_action_provider.approve"
    ) as mock_approve:
        mock_approve.return_value = True

        result = morpho_action_provider().deposit(
            mock_wallet,
            {
                "vault_address": MOCK_VAULT_ADDRESS,
                "token_address": MOCK_TOKEN_ADDRESS,
                "assets": "100.5",
                "receiver": MOCK_RECEIVER,
            },
        )

        # 100.5 * 10^6 = 100500000
        mock_approve.assert_called_once_with(
            mock_wallet, MOCK_TOKEN_ADDRESS, MOCK_VAULT_ADDRESS, 100500000
        )

        assert MOCK_TX_HASH in result
        assert "Deposited 100.5" in result


# Withdraw Tests
def test_morpho_withdraw_success():
    """Test successful morpho withdraw with valid parameters."""
    mock_wallet = MagicMock()
    mock_wallet.send_transaction.return_value = MOCK_TX_HASH
    mock_wallet.read_contract.return_value = MOCK_DECIMALS

    with patch("web3.eth.Contract") as mock_contract:
        mock_contract.return_value.encode_abi.return_value = b"encoded_data"

        result = morpho_action_provider().withdraw(
            mock_wallet,
            {
                "vault_address": MOCK_VAULT_ADDRESS,
                "token_address": MOCK_TOKEN_ADDRESS,
                "assets": "1.0",
                "receiver": MOCK_RECEIVER,
            },
        )

        # Verify decimals were fetched from token contract
        mock_wallet.read_contract.assert_called_once()

        assert MOCK_TX_HASH in result
        assert "Withdrawn 1.0" in result
        mock_wallet.send_transaction.assert_called_once()
        mock_wallet.wait_for_transaction_receipt.assert_called_once_with(MOCK_TX_HASH)


def test_morpho_withdraw_zero_amount():
    """Test morpho withdraw with zero amount."""
    mock_wallet = MagicMock()

    result = morpho_action_provider().withdraw(
        mock_wallet,
        {
            "vault_address": MOCK_VAULT_ADDRESS,
            "token_address": MOCK_TOKEN_ADDRESS,
            "assets": "0.0",
            "receiver": MOCK_RECEIVER,
        },
    )

    assert "Error: Assets amount must be greater than 0" in result
    mock_wallet.send_transaction.assert_not_called()


def test_morpho_withdraw_negative_amount():
    """Test morpho withdraw with negative amount."""
    mock_wallet = MagicMock()

    result = morpho_action_provider().withdraw(
        mock_wallet,
        {
            "vault_address": MOCK_VAULT_ADDRESS,
            "token_address": MOCK_TOKEN_ADDRESS,
            "assets": "-1.0",
            "receiver": MOCK_RECEIVER,
        },
    )

    assert "Error: Assets amount must be greater than 0" in result


def test_morpho_withdraw_invalid_amount():
    """Test morpho withdraw with invalid amount string."""
    mock_wallet = MagicMock()

    with pytest.raises(decimal.InvalidOperation):
        morpho_action_provider().withdraw(
            mock_wallet,
            {
                "vault_address": MOCK_VAULT_ADDRESS,
                "token_address": MOCK_TOKEN_ADDRESS,
                "assets": "invalid_amount",
                "receiver": MOCK_RECEIVER,
            },
        )


def test_morpho_withdraw_transaction_failure():
    """Test morpho withdraw when transaction fails."""
    mock_wallet = MagicMock()
    mock_wallet.send_transaction.side_effect = Exception("Transaction failed")
    mock_wallet.read_contract.return_value = MOCK_DECIMALS

    with patch("web3.eth.Contract") as mock_contract:
        mock_contract.return_value.encode_abi.return_value = b"encoded_data"

        result = morpho_action_provider().withdraw(
            mock_wallet,
            {
                "vault_address": MOCK_VAULT_ADDRESS,
                "token_address": MOCK_TOKEN_ADDRESS,
                "assets": "1.0",
                "receiver": MOCK_RECEIVER,
            },
        )

        assert "Error withdrawing from Morpho Vault" in result


def test_morpho_withdraw_non_18_decimals():
    """Test morpho withdraw with token that has non-18 decimals (e.g., USDC with 6)."""
    mock_wallet = MagicMock()
    mock_wallet.send_transaction.return_value = MOCK_TX_HASH
    mock_wallet.read_contract.return_value = 6  # USDC has 6 decimals

    with patch("web3.eth.Contract") as mock_contract:
        mock_contract.return_value.encode_abi.return_value = b"encoded_data"

        result = morpho_action_provider().withdraw(
            mock_wallet,
            {
                "vault_address": MOCK_VAULT_ADDRESS,
                "token_address": MOCK_TOKEN_ADDRESS,
                "assets": "100.5",
                "receiver": MOCK_RECEIVER,
            },
        )

        # Verify the contract was called with correct atomic amount: 100.5 * 10^6 = 100500000
        mock_contract.return_value.encode_abi.assert_called_once()
        call_args = mock_contract.return_value.encode_abi.call_args
        assert call_args[0][0] == "withdraw"
        # First arg should be atomic_assets = 100500000
        assert call_args[0][1][0] == 100500000

        assert MOCK_TX_HASH in result
        assert "Withdrawn 100.5" in result


# Network Support Tests
def test_morpho_supports_network_base_mainnet():
    """Test that morpho provider supports base-mainnet."""
    provider = morpho_action_provider()
    mock_network = MagicMock()
    mock_network.network_id = "base-mainnet"

    assert provider.supports_network(mock_network) is True


def test_morpho_supports_network_base_sepolia():
    """Test that morpho provider supports base-sepolia."""
    provider = morpho_action_provider()
    mock_network = MagicMock()
    mock_network.network_id = "base-sepolia"

    assert provider.supports_network(mock_network) is True


def test_morpho_supports_network_unsupported():
    """Test that morpho provider does not support other networks."""
    provider = morpho_action_provider()
    mock_network = MagicMock()
    mock_network.network_id = "ethereum-mainnet"

    assert provider.supports_network(mock_network) is False
