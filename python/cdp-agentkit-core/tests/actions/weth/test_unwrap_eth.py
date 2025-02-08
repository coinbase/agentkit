from unittest.mock import patch

import pytest

from cdp_agentkit_core.actions.weth.constants import WETH_ABI, WETH_ADDRESS
from cdp_agentkit_core.actions.weth.unwrap_eth import (
    UnwrapWethAction,
    UnwrapWethInput,
    unwrap_weth,
)


def test_unwrap_weth_success(wallet_factory, contract_invocation_factory):
    """Test successful WETH unwrapping."""
    mock_wallet = wallet_factory()
    mock_invocation = contract_invocation_factory()

    amount = 0.1  # 0.1 WETH

    with (
        patch.object(
            mock_wallet, "invoke_contract", return_value=mock_invocation
        ) as mock_invoke_contract,
        patch.object(mock_invocation, "wait", return_value=mock_invocation) as mock_invocation_wait,
    ):
        result = unwrap_weth(mock_wallet, amount)

        mock_invoke_contract.assert_called_once_with(
            contract_address=WETH_ADDRESS,
            method="withdraw",
            abi=WETH_ABI,
            args={"wad": "100000000000000000"},  # 0.1 WETH in wei
            amount="0",
            asset_id="wei",
        )
        mock_invocation_wait.assert_called_once_with()

    assert (
        result
        == f"Unwrapped {amount} WETH with transaction hash: {mock_invocation.transaction.transaction_hash}"
    )


def test_unwrap_weth_failure(wallet_factory):
    """Test WETH unwrapping failure."""
    mock_wallet = wallet_factory()
    mock_wallet.invoke_contract.side_effect = Exception("Test error")

    amount = 1.0
    result = unwrap_weth(mock_wallet, amount)

    assert result == "Unexpected error unwrapping WETH: Test error"


def test_unwrap_weth_action_initialization():
    """Test UnwrapWethAction initialization and attributes."""
    action = UnwrapWethAction()

    assert action.name == "unwrap_weth"
    assert action.args_schema == UnwrapWethInput
    assert callable(action.func)


def test_unwrap_weth_input_model_valid():
    """Test UnwrapWethInput accepts valid parameters."""
    valid_input = UnwrapWethInput(amount_to_unwrap=1.5)
    assert valid_input.amount_to_unwrap == 1.5


def test_unwrap_weth_input_model_missing_params():
    """Test UnwrapWethInput raises error when params are missing."""
    with pytest.raises(ValueError):
        UnwrapWethInput()


def test_unwrap_weth_input_model_invalid_amount():
    """Test UnwrapWethInput raises error for invalid amounts."""
    with pytest.raises(ValueError):
        UnwrapWethInput(amount_to_unwrap=0)

    with pytest.raises(ValueError):
        UnwrapWethInput(amount_to_unwrap=-1.5)
