"""Tests for CDP Wallet Provider contract interactions."""

from unittest.mock import Mock, patch

import pytest
from web3.exceptions import ContractLogicError

from .conftest import MOCK_ADDRESS_TO

# =========================================================
# contract interaction tests
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

    result = mocked_wallet_provider.read_contract(contract_address, abi, "testFunction", ["arg1"])

    assert result == "mock_result"
    mock_web3.return_value.eth.contract.assert_called_once_with(address=contract_address, abi=abi)


def test_read_contract_error(mocked_wallet_provider, mock_web3):
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
    mock_function.call.side_effect = Exception("Contract call failed")

    mock_contract = Mock()
    mock_contract.functions = {"testFunction": lambda *args: mock_function}

    mock_web3.return_value.eth.contract.return_value = mock_contract

    with pytest.raises(Exception, match="Contract call failed"):
        mocked_wallet_provider.read_contract(contract_address, abi, "testFunction", ["arg1"])


def test_read_contract_with_invalid_abi(mocked_wallet_provider):
    """Test read_contract method with invalid ABI."""
    contract_address = MOCK_ADDRESS_TO
    invalid_abi = "not_a_valid_abi"

    with (
        patch.object(
            mocked_wallet_provider._web3.eth,
            "contract",
            side_effect=TypeError("Invalid ABI format"),
        ),
        pytest.raises(TypeError, match="Invalid ABI format"),
    ):
        mocked_wallet_provider.read_contract(contract_address, invalid_abi, "testFunction")


def test_read_contract_with_contract_logic_error(mocked_wallet_provider):
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

    error_message = "execution reverted: Insufficient balance"

    with patch.object(mocked_wallet_provider._web3.eth, "contract") as mock_contract_method:
        mock_function = Mock()
        mock_function.call.side_effect = ContractLogicError(error_message)

        mock_contract = Mock()
        mock_contract.functions = {"testFunction": lambda *args: mock_function}
        mock_contract_method.return_value = mock_contract

        with pytest.raises(ContractLogicError, match=error_message):
            mocked_wallet_provider.read_contract(contract_address, abi, "testFunction")
