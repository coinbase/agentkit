"""Tests for ETH Account Wallet Provider contract operations."""

from unittest.mock import Mock

import pytest

from .conftest import MOCK_ADDRESS_TO

# =========================================================
# contract tests
# =========================================================


def test_read_contract(wallet_provider, mock_web3):
    """Test read_contract method."""
    contract_address = MOCK_ADDRESS_TO
    abi = [
        {
            "name": "testFunction",
            "type": "function",
            "inputs": [],
            "outputs": [{"type": "string"}],
        }
    ]

    result = wallet_provider.read_contract(contract_address, abi, "testFunction", ["arg1"])

    assert result == "mock_result"
    mock_web3.return_value.eth.contract.assert_called_once_with(address=contract_address, abi=abi)


def test_read_contract_error(wallet_provider, mock_web3):
    """Test read_contract method when contract call fails."""
    contract_address = MOCK_ADDRESS_TO
    abi = [
        {
            "name": "testFunction",
            "type": "function",
            "inputs": [],
            "outputs": [{"type": "string"}],
        }
    ]

    mock_contract = Mock()
    mock_contract.functions = {}
    mock_web3.return_value.eth.contract.return_value = mock_contract

    with pytest.raises(KeyError, match="testFunction"):
        wallet_provider.read_contract(contract_address, abi, "testFunction", ["arg1"])


def test_read_contract_with_invalid_abi(wallet_provider, mock_web3):
    """Test read_contract method with invalid ABI."""
    contract_address = MOCK_ADDRESS_TO
    invalid_abi = "not_a_valid_abi"

    mock_web3.return_value.eth.contract.side_effect = TypeError("Invalid ABI format")

    with pytest.raises(TypeError, match="Invalid ABI format"):
        wallet_provider.read_contract(contract_address, invalid_abi, "testFunction")


def test_read_contract_with_contract_logic_error(wallet_provider, mock_web3):
    """Test read_contract method with contract logic error."""
    contract_address = MOCK_ADDRESS_TO
    abi = [
        {
            "name": "testFunction",
            "type": "function",
            "inputs": [],
            "outputs": [{"type": "string"}],
        }
    ]

    mock_function = Mock()
    error_message = "execution reverted: Insufficient balance"

    from web3.exceptions import ContractLogicError

    mock_function.call.side_effect = ContractLogicError(error_message)

    mock_contract = Mock()
    mock_contract.functions = {"testFunction": lambda *args: mock_function}
    mock_web3.return_value.eth.contract.return_value = mock_contract

    with pytest.raises(ContractLogicError, match=error_message):
        wallet_provider.read_contract(contract_address, abi, "testFunction")
