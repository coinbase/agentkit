"""Tests for Basename action provider."""

from unittest.mock import ANY

from web3 import Web3

from coinbase_agentkit.action_providers.basename.constants import (
    BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_MAINNET,
    BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_TESTNET,
)
from coinbase_agentkit.network import Network

from .conftest import MOCK_ADDRESS, MOCK_AMOUNT, MOCK_BASENAME, MOCK_TX_HASH


def test_register_basename_mainnet_success(provider, mock_wallet_provider):
    """Test successful basename registration on mainnet."""
    args = {
        "basename": MOCK_BASENAME,
        "amount": MOCK_AMOUNT,
    }

    response = provider.register_basename(mock_wallet_provider, args)

    expected_basename = f"{MOCK_BASENAME}.base.eth"
    mock_wallet_provider.send_transaction.assert_called_once_with(
        {
            "to": BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_MAINNET,
            "data": ANY,
            "value": Web3.to_wei(MOCK_AMOUNT, "ether"),
        }
    )
    mock_wallet_provider.wait_for_transaction_receipt.assert_called_once_with(MOCK_TX_HASH)
    assert (
        response
        == f"Successfully registered basename {expected_basename} for address {MOCK_ADDRESS}"
    )


def test_register_basename_testnet_success(provider, mock_wallet_provider):
    """Test successful basename registration on testnet."""
    mock_wallet_provider.get_network.return_value = Network(
        protocol_family="evm", chain_id="84532", network_id="base-sepolia"
    )

    args = {
        "basename": MOCK_BASENAME,
        "amount": MOCK_AMOUNT,
    }

    response = provider.register_basename(mock_wallet_provider, args)

    expected_basename = f"{MOCK_BASENAME}.basetest.eth"
    mock_wallet_provider.send_transaction.assert_called_once_with(
        {
            "to": BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_TESTNET,
            "data": ANY,
            "value": Web3.to_wei(MOCK_AMOUNT, "ether"),
        }
    )
    mock_wallet_provider.wait_for_transaction_receipt.assert_called_once_with(MOCK_TX_HASH)
    assert (
        response
        == f"Successfully registered basename {expected_basename} for address {MOCK_ADDRESS}"
    )


def test_register_basename_with_suffix(provider, mock_wallet_provider):
    """Test registration when basename already includes suffix."""
    args = {
        "basename": f"{MOCK_BASENAME}.base.eth",
        "amount": MOCK_AMOUNT,
    }

    response = provider.register_basename(mock_wallet_provider, args)
    assert (
        response
        == f"Successfully registered basename {MOCK_BASENAME}.base.eth for address {MOCK_ADDRESS}"
    )


def test_register_basename_error(provider, mock_wallet_provider):
    """Test error handling in basename registration."""
    mock_wallet_provider.send_transaction.side_effect = Exception("Registration failed")

    args = {
        "basename": MOCK_BASENAME,
        "amount": MOCK_AMOUNT,
    }

    response = provider.register_basename(mock_wallet_provider, args)
    assert response == "Error registering basename: Registration failed"


def test_supports_network(provider):
    """Test network support check."""
    test_cases = [
        ("base-mainnet", "8453", True),
        ("base-sepolia", "84532", True),
        ("ethereum-mainnet", "1", False),
        ("optimism", "10", False),
        ("arbitrum", "42161", False),
    ]

    for network_id, chain_id, expected in test_cases:
        network = Network(protocol_family="evm", chain_id=chain_id, network_id=network_id)
        assert provider.supports_network(network) is expected
