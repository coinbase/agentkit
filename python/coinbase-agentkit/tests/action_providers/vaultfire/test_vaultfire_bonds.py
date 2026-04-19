"""Tests for bond creation actions (accountability and partnership)."""

from unittest.mock import MagicMock


# ──────────────────────────────────────────────────
# Accountability Bonds
# ──────────────────────────────────────────────────

def test_create_accountability_bond_success(vaultfire_provider, vaultfire_wallet):
    """Test successful accountability bond creation."""
    result = vaultfire_provider.create_accountability_bond(
        vaultfire_wallet,
        {"amount": "0.01"},
    )

    assert "Successfully created Accountability Bond" in result
    assert "0.01" in result
    vaultfire_wallet.send_transaction.assert_called_once()

    # Verify value was included in the transaction
    call_args = vaultfire_wallet.send_transaction.call_args[0][0]
    assert "value" in call_args


def test_create_accountability_bond_unsupported_network(vaultfire_provider):
    """Test accountability bond on unsupported network."""
    wallet = MagicMock()
    network = MagicMock()
    network.network_id = "ethereum-mainnet"
    wallet.get_network.return_value = network

    result = vaultfire_provider.create_accountability_bond(
        wallet,
        {"amount": "0.01"},
    )

    assert "Error" in result
    assert "not deployed" in result


def test_create_accountability_bond_tx_failure(vaultfire_provider, vaultfire_wallet):
    """Test accountability bond when transaction fails."""
    vaultfire_wallet.send_transaction.side_effect = Exception("gas estimation failed")

    result = vaultfire_provider.create_accountability_bond(
        vaultfire_wallet,
        {"amount": "0.01"},
    )

    assert "Error" in result
    assert "gas estimation failed" in result


# ──────────────────────────────────────────────────
# Partnership Bonds
# ──────────────────────────────────────────────────

def test_create_partnership_bond_success(vaultfire_provider, vaultfire_wallet):
    """Test successful partnership bond creation."""
    result = vaultfire_provider.create_partnership_bond(
        vaultfire_wallet,
        {
            "partner_address": "0x9876543210987654321098765432109876543210",
            "amount": "0.05",
        },
    )

    assert "Successfully created Partnership Bond" in result
    assert "0x9876543210987654321098765432109876543210" in result
    assert "0.05" in result
    vaultfire_wallet.send_transaction.assert_called_once()


def test_create_partnership_bond_unsupported_network(vaultfire_provider):
    """Test partnership bond on unsupported network."""
    wallet = MagicMock()
    network = MagicMock()
    network.network_id = "solana-mainnet"
    wallet.get_network.return_value = network

    result = vaultfire_provider.create_partnership_bond(
        wallet,
        {
            "partner_address": "0x9876543210987654321098765432109876543210",
            "amount": "0.01",
        },
    )

    assert "Error" in result
    assert "not deployed" in result
