"""Tests for the register_agent action."""

from unittest.mock import MagicMock


def test_register_agent_success(vaultfire_provider, vaultfire_wallet):
    """Test successful agent registration."""
    # read_contract returns False (not yet registered)
    vaultfire_wallet.read_contract.return_value = False

    result = vaultfire_provider.register_agent(
        vaultfire_wallet,
        {"name": "test-agent", "agent_type": "autonomous"},
    )

    assert "Successfully registered" in result
    assert "test-agent" in result
    assert "autonomous" in result
    vaultfire_wallet.send_transaction.assert_called_once()
    vaultfire_wallet.wait_for_transaction_receipt.assert_called_once()


def test_register_agent_already_registered(vaultfire_provider, vaultfire_wallet):
    """Test registration when agent is already registered."""
    vaultfire_wallet.read_contract.return_value = True

    result = vaultfire_provider.register_agent(
        vaultfire_wallet,
        {"name": "test-agent", "agent_type": "autonomous"},
    )

    assert "already registered" in result
    vaultfire_wallet.send_transaction.assert_not_called()


def test_register_agent_unsupported_network(vaultfire_provider):
    """Test registration on unsupported network."""
    wallet = MagicMock()
    wallet.get_address.return_value = "0x1234567890123456789012345678901234567890"
    network = MagicMock()
    network.network_id = "ethereum-mainnet"
    wallet.get_network.return_value = network

    result = vaultfire_provider.register_agent(
        wallet,
        {"name": "test-agent", "agent_type": "autonomous"},
    )

    assert "Error" in result
    assert "not deployed" in result


def test_register_agent_tx_failure(vaultfire_provider, vaultfire_wallet):
    """Test registration when the transaction fails."""
    vaultfire_wallet.read_contract.return_value = False
    vaultfire_wallet.send_transaction.side_effect = Exception("insufficient funds")

    result = vaultfire_provider.register_agent(
        vaultfire_wallet,
        {"name": "test-agent", "agent_type": "autonomous"},
    )

    assert "Error" in result
    assert "insufficient funds" in result
