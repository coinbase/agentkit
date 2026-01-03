"""Tests for CDP EVM Smart Wallet Provider contract operations."""

from unittest.mock import Mock

import pytest
from web3.exceptions import ContractLogicError

from .conftest import MOCK_ADDRESS_TO

# =========================================================
# contract tests
# =========================================================


def test_read_contract(mocked_wallet_provider, mock_web3):
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
    args = ["arg1"]
    block_identifier = "latest"

    result = mocked_wallet_provider.read_contract(
        contract_address, abi, "testFunction", args, block_identifier
    )

    assert result == "mock_result"
    mock_web3.return_value.eth.contract.assert_called_once_with(address=contract_address, abi=abi)
    mock_web3.return_value.eth.contract().functions["testFunction"]().call.assert_called_once_with(
        block_identifier=block_identifier
    )


def test_read_contract_empty_args(mocked_wallet_provider, mock_web3):
    """Test read_contract method with empty args."""
    contract_address = MOCK_ADDRESS_TO
    abi = [
        {
            "name": "testFunction",
            "type": "function",
            "inputs": [],
            "outputs": [{"type": "string"}],
        }
    ]

    result = mocked_wallet_provider.read_contract(contract_address, abi, "testFunction")

    assert result == "mock_result"
    mock_web3.return_value.eth.contract.assert_called_once_with(address=contract_address, abi=abi)


def test_read_contract_with_complex_return_value(mocked_wallet_provider, mock_web3):
    """Test read_contract method with complex return value."""
    contract_address = MOCK_ADDRESS_TO
    abi = [
        {
            "name": "testFunction",
            "type": "function",
            "inputs": [],
            "outputs": [
                {"type": "uint256", "name": "amount"},
                {"type": "address", "name": "owner"},
            ],
        }
    ]

    complex_return = (1000, "0xabcdef")
    mock_function = Mock()
    mock_function.call.return_value = complex_return

    mock_contract = Mock()
    mock_contract.functions = {"testFunction": lambda *args: mock_function}
    mock_web3.return_value.eth.contract.return_value = mock_contract

    result = mocked_wallet_provider.read_contract(contract_address, abi, "testFunction")

    assert result == complex_return


def test_read_contract_with_specific_block(mocked_wallet_provider, mock_web3):
    """Test read_contract method with specific block identifier."""
    contract_address = MOCK_ADDRESS_TO
    abi = [{"name": "testFunction", "type": "function", "inputs": [], "outputs": []}]

    block_number = 12345678

    mocked_wallet_provider.read_contract(
        contract_address, abi, "testFunction", block_identifier=block_number
    )

    mock_web3.return_value.eth.contract().functions["testFunction"]().call.assert_called_once_with(
        block_identifier=block_number
    )


def test_read_contract_with_multiple_inputs(mocked_wallet_provider, mock_web3):
    """Test read_contract method with multiple input arguments."""
    contract_address = MOCK_ADDRESS_TO
    abi = [
        {
            "name": "complexFunction",
            "type": "function",
            "inputs": [
                {"type": "uint256", "name": "amount"},
                {"type": "address", "name": "recipient"},
                {"type": "bool", "name": "flag"},
            ],
            "outputs": [{"type": "bool"}],
        }
    ]

    mock_complex_function = Mock()
    mock_complex_function.call.return_value = True

    mock_contract = Mock()
    mock_contract.functions = {"complexFunction": lambda *args: mock_complex_function}
    mock_web3.return_value.eth.contract.return_value = mock_contract

    args = [100, "0xabcdef1234567890", True]

    result = mocked_wallet_provider.read_contract(contract_address, abi, "complexFunction", args)

    assert result is True
    mock_web3.return_value.eth.contract.assert_called_once_with(address=contract_address, abi=abi)


def test_read_contract_function_not_found(mocked_wallet_provider, mock_web3):
    """Test read_contract method with non-existent function."""
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

    with pytest.raises(KeyError, match="nonExistentFunction"):
        mocked_wallet_provider.read_contract(contract_address, abi, "nonExistentFunction")


def test_read_contract_call_failure(mocked_wallet_provider, mock_web3):
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

    mock_function = Mock()
    error_message = "Contract call reverted"
    mock_function.call.side_effect = Exception(error_message)

    mock_contract = Mock()
    mock_contract.functions = {"testFunction": lambda *args: mock_function}
    mock_web3.return_value.eth.contract.return_value = mock_contract

    with pytest.raises(Exception, match=error_message):
        mocked_wallet_provider.read_contract(contract_address, abi, "testFunction")


def test_read_contract_with_contract_logic_error(mocked_wallet_provider, mock_web3):
    """Test read_contract method with ContractLogicError exception."""
    contract_address = MOCK_ADDRESS_TO
    abi = [{"name": "revertingFunction", "type": "function", "inputs": [], "outputs": []}]

    mock_function = Mock()
    error_message = "execution reverted: Insufficient balance"
    mock_function.call.side_effect = ContractLogicError(error_message)

    mock_contract = Mock()
    mock_contract.functions = {"revertingFunction": lambda *args: mock_function}
    mock_web3.return_value.eth.contract.return_value = mock_contract

    with pytest.raises(ContractLogicError, match=error_message):
        mocked_wallet_provider.read_contract(contract_address, abi, "revertingFunction")


def test_read_contract_with_invalid_abi(mocked_wallet_provider, mock_web3):
    """Test read_contract method with invalid ABI."""
    contract_address = MOCK_ADDRESS_TO
    invalid_abi = "not_a_valid_abi"

    mock_web3.return_value.eth.contract.side_effect = TypeError("Invalid ABI format")

    with pytest.raises(TypeError, match="Invalid ABI format"):
        mocked_wallet_provider.read_contract(contract_address, invalid_abi, "testFunction")


def test_read_contract_with_invalid_address(mocked_wallet_provider, mock_web3):
    """Test read_contract method with invalid contract address."""
    invalid_address = "not_a_valid_address"
    abi = [{"name": "testFunction", "type": "function", "inputs": [], "outputs": []}]

    mock_web3.return_value.eth.contract.side_effect = ValueError("Invalid address")

    with pytest.raises(ValueError, match="Invalid address"):
        mocked_wallet_provider.read_contract(invalid_address, abi, "testFunction")
