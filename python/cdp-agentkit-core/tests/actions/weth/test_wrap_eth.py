from unittest.mock import patch

import pytest

from cdp_agentkit_core.actions.weth.constants import WETH_ABI, WETH_ADDRESS
from cdp_agentkit_core.actions.weth.wrap_eth import (
    WrapEthAction,
    WrapEthInput,
    wrap_eth,
)


def test_wrap_eth_success(wallet_factory, contract_invocation_factory):
    """Test successful ETH wrapping."""
    mock_wallet = wallet_factory()
    mock_invocation = contract_invocation_factory()

    amount = 0.1  # 0.1 ETH

    with (
        patch.object(
            mock_wallet, "invoke_contract", return_value=mock_invocation
        ) as mock_invoke_contract,
        patch.object(mock_invocation, "wait", return_value=mock_invocation) as mock_invocation_wait,
    ):
        result = wrap_eth(mock_wallet, amount)

        mock_invoke_contract.assert_called_once_with(
            contract_address=WETH_ADDRESS,
            method="deposit",
            abi=WETH_ABI,
            args={},
            amount="100000000000000000",  # 0.1 ETH in wei
            asset_id="wei",
        )
        mock_invocation_wait.assert_called_once_with()

    assert (
        result
        == f"Wrapped {amount} ETH with transaction hash: {mock_invocation.transaction.transaction_hash}"
    )


def test_wrap_eth_failure(wallet_factory):
    """Test ETH wrapping failure."""
    mock_wallet = wallet_factory()
    mock_wallet.invoke_contract.side_effect = Exception("Test error")

    amount = 1.0
    result = wrap_eth(mock_wallet, amount)

    assert result == "Unexpected error wrapping ETH: Test error"


def test_wrap_eth_action_initialization():
    """Test WrapEthAction initialization and attributes."""
    action = WrapEthAction()

    assert action.name == "wrap_eth"
    assert action.args_schema == WrapEthInput
    assert callable(action.func)


def test_wrap_eth_input_model_valid():
    """Test WrapEthInput accepts valid parameters."""
    valid_input = WrapEthInput(amount_to_wrap=1.5)
    assert valid_input.amount_to_wrap == 1.5


def test_wrap_eth_input_model_missing_params():
    """Test WrapEthInput raises error when params are missing."""
    with pytest.raises(ValueError):
        WrapEthInput()


def test_wrap_eth_input_model_invalid_amount():
    """Test WrapEthInput raises error for invalid amounts."""
    with pytest.raises(ValueError):
        WrapEthInput(amount_to_wrap=0)

    with pytest.raises(ValueError):
        WrapEthInput(amount_to_wrap=-1.5)
