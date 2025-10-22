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


def test_morpho_deposit_approval_error():
    """Test morpho deposit with approval error."""
    mock_wallet = MagicMock()

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


# Withdraw Tests
def test_morpho_withdraw_success():
    """Test successful morpho withdraw with valid parameters."""
    mock_wallet = MagicMock()
    mock_wallet.send_transaction.return_value = MOCK_TX_HASH

    with patch("web3.eth.Contract") as mock_contract:
        mock_contract.return_value.encode_abi.return_value = b"encoded_data"

        result = morpho_action_provider().withdraw(
            mock_wallet,
            {"vault_address": MOCK_VAULT_ADDRESS, "assets": "1.0", "receiver": MOCK_RECEIVER},
        )

        assert MOCK_TX_HASH in result
        assert "Withdrawn 1.0" in result
        mock_wallet.send_transaction.assert_called_once()
        mock_wallet.wait_for_transaction_receipt.assert_called_once_with(MOCK_TX_HASH)


def test_morpho_withdraw_zero_amount():
    """Test morpho withdraw with zero amount."""
    mock_wallet = MagicMock()

    result = morpho_action_provider().withdraw(
        mock_wallet,
        {"vault_address": MOCK_VAULT_ADDRESS, "assets": "0.0", "receiver": MOCK_RECEIVER},
    )

    assert "Error: Assets amount must be greater than 0" in result
    mock_wallet.send_transaction.assert_not_called()


def test_morpho_withdraw_negative_amount():
    """Test morpho withdraw with negative amount."""
    mock_wallet = MagicMock()

    result = morpho_action_provider().withdraw(
        mock_wallet,
        {"vault_address": MOCK_VAULT_ADDRESS, "assets": "-1.0", "receiver": MOCK_RECEIVER},
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
                "assets": "invalid_amount",
                "receiver": MOCK_RECEIVER,
            },
        )


def test_morpho_withdraw_transaction_error():
    """Test morpho withdraw with transaction error."""
    mock_wallet = MagicMock()
    mock_wallet.send_transaction.side_effect = Exception("Transaction failed")

    with patch("web3.eth.Contract") as mock_contract:
        mock_contract.return_value.encode_abi.return_value = b"encoded_data"

        result = morpho_action_provider().withdraw(
            mock_wallet,
            {"vault_address": MOCK_VAULT_ADDRESS, "assets": "1.0", "receiver": MOCK_RECEIVER},
        )

        assert "Error withdrawing from Morpho Vault" in result


# Network Support Tests
def test_supports_network():
    """Test network support checking."""
    provider = morpho_action_provider()

    # Test supported network
    supported_network = Network(protocol_family="evm", network_id="base-mainnet")
    assert provider.supports_network(supported_network) is True

    # Test unsupported network
    unsupported_network = Network(protocol_family="evm", network_id="ethereum-mainnet")
    assert provider.supports_network(unsupported_network) is False

    # Test unsupported protocol family
    wrong_family_network = Network(protocol_family="solana", network_id="base-mainnet")
    assert provider.supports_network(wrong_family_network) is False


def test_morpho_invalid_network():
    """Test morpho with invalid network."""
    provider = morpho_action_provider()

    # Create a valid Network object but with unsupported values
    invalid_network = Network(protocol_family="invalid", network_id=None)
    assert provider.supports_network(invalid_network) is False
