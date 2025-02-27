"""Tests for the ERC20 action provider."""

from unittest.mock import call

import pytest
from web3 import Web3

from coinbase_agentkit.action_providers.erc20.constants import ERC20_ABI
from coinbase_agentkit.action_providers.erc20.erc20_action_provider import (
    erc20_action_provider,
)
from coinbase_agentkit.action_providers.erc20.schemas import GetBalanceSchema, TransferSchema
from coinbase_agentkit.network import Network

from .conftest import (
    MOCK_AMOUNT,
    MOCK_CONTRACT_ADDRESS,
    MOCK_DECIMALS,
    MOCK_DESTINATION,
)


def test_get_balance_schema_valid():
    """Test that the GetBalanceSchema validates correctly."""
    valid_input = {"contract_address": MOCK_CONTRACT_ADDRESS}
    schema = GetBalanceSchema(**valid_input)
    assert schema.contract_address == MOCK_CONTRACT_ADDRESS


def test_get_balance_schema_invalid():
    """Test that the GetBalanceSchema fails on invalid input."""
    with pytest.raises(ValueError):
        GetBalanceSchema()


def test_get_balance_success(mock_wallet):
    """Test successful get_balance call."""
    args = {"contract_address": MOCK_CONTRACT_ADDRESS}
    provider = erc20_action_provider()

    response = provider.get_balance(mock_wallet, args)

    mock_wallet.read_contract.assert_has_calls(
        [
            call(
                contract_address=MOCK_CONTRACT_ADDRESS,
                abi=ERC20_ABI,
                function_name="balanceOf",
                args=[mock_wallet.get_address()],
            ),
            call(
                contract_address=MOCK_CONTRACT_ADDRESS,
                abi=ERC20_ABI,
                function_name="decimals",
                args=[],
            ),
        ]
    )
    assert (
        f"Balance of {MOCK_CONTRACT_ADDRESS} is {int(MOCK_AMOUNT) / 10 ** MOCK_DECIMALS}"
        in response
    )


def test_get_balance_error(mock_wallet):
    """Test get_balance with error."""
    args = {"contract_address": MOCK_CONTRACT_ADDRESS}
    error = Exception("Failed to get balance")
    mock_wallet.read_contract.side_effect = error
    provider = erc20_action_provider()

    response = provider.get_balance(mock_wallet, args)

    mock_wallet.read_contract.assert_called_once_with(
        contract_address=MOCK_CONTRACT_ADDRESS,
        abi=ERC20_ABI,
        function_name="balanceOf",
        args=[mock_wallet.get_address()],
    )
    assert f"Error getting balance: {error!s}" in response


def test_transfer_schema_valid():
    """Test that the TransferSchema validates correctly."""
    valid_input = {
        "amount": MOCK_AMOUNT,
        "contract_address": MOCK_CONTRACT_ADDRESS,
        "destination": MOCK_DESTINATION,
    }
    schema = TransferSchema(**valid_input)
    assert schema.amount == MOCK_AMOUNT
    assert schema.contract_address == MOCK_CONTRACT_ADDRESS
    assert schema.destination == MOCK_DESTINATION


def test_transfer_schema_invalid():
    """Test that the TransferSchema fails on invalid input."""
    with pytest.raises(ValueError):
        TransferSchema()


def test_transfer_success(mock_wallet):
    """Test successful transfer call."""
    args = {
        "amount": MOCK_AMOUNT,
        "contract_address": MOCK_CONTRACT_ADDRESS,
        "destination": MOCK_DESTINATION,
    }
    provider = erc20_action_provider()

    mock_tx_hash = "0xghijkl987654321"
    mock_wallet.send_transaction.return_value = mock_tx_hash

    response = provider.transfer(mock_wallet, args)

    contract = Web3().eth.contract(address=MOCK_CONTRACT_ADDRESS, abi=ERC20_ABI)
    expected_data = contract.encode_abi("transfer", [MOCK_DESTINATION, int(MOCK_AMOUNT)])

    mock_wallet.send_transaction.assert_called_once_with(
        {
            "to": MOCK_CONTRACT_ADDRESS,
            "data": expected_data,
        }
    )
    mock_wallet.wait_for_transaction_receipt.assert_called_once_with(mock_tx_hash)
    assert f"Transferred {MOCK_AMOUNT} of {MOCK_CONTRACT_ADDRESS} to {MOCK_DESTINATION}" in response
    assert f"Transaction hash for the transfer: {mock_tx_hash}" in response


def test_transfer_error(mock_wallet):
    """Test transfer with error."""
    args = {
        "amount": MOCK_AMOUNT,
        "contract_address": MOCK_CONTRACT_ADDRESS,
        "destination": MOCK_DESTINATION,
    }
    error = Exception("Failed to execute transfer")
    mock_wallet.send_transaction.side_effect = error
    provider = erc20_action_provider()

    response = provider.transfer(mock_wallet, args)

    contract = Web3().eth.contract(address=MOCK_CONTRACT_ADDRESS, abi=ERC20_ABI)
    expected_data = contract.encode_abi("transfer", [MOCK_DESTINATION, int(MOCK_AMOUNT)])

    mock_wallet.send_transaction.assert_called_once_with(
        {
            "to": MOCK_CONTRACT_ADDRESS,
            "data": expected_data,
        }
    )
    assert f"Error transferring the asset: {error!s}" in response


def test_supports_network():
    """Test network support based on protocol family."""
    test_cases = [
        ("evm", True),
        ("solana", False),
    ]

    provider = erc20_action_provider()
    for protocol_family, expected in test_cases:
        network = Network(chain_id="1", protocol_family=protocol_family)
        assert provider.supports_network(network) is expected
