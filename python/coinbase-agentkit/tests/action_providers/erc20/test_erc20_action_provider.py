"""Tests for the ERC20 action provider."""

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from web3 import Web3
from web3.datastructures import AttributeDict

from coinbase_agentkit.action_providers.erc20.constants import ERC20_ABI
from coinbase_agentkit.action_providers.erc20.erc20_action_provider import (
    erc20_action_provider,
)
from coinbase_agentkit.action_providers.erc20.schemas import (
    AllowanceSchema,
    ApproveSchema,
    GetBalanceSchema,
    TransferSchema,
)
from coinbase_agentkit.network import Network

from .conftest import (
    MOCK_AMOUNT,
    MOCK_CONTRACT_ADDRESS,
    MOCK_DECIMALS,
    MOCK_DESTINATION,
    MOCK_SPENDER,
    MOCK_TOKEN_NAME,
    create_token_details,
)

TRANSFER_ARGS = {
    "amount": "1.5",
    "contract_address": MOCK_CONTRACT_ADDRESS,
    "destination_address": MOCK_DESTINATION,
}
APPROVE_ARGS = {
    "amount": "100",
    "contract_address": MOCK_CONTRACT_ADDRESS,
    "spender_address": MOCK_SPENDER,
}

# web3.py receipts carry an integer status; CDP receipts and user operations use strings.
SUCCEEDED_RECEIPTS = [
    AttributeDict({"status": 1}),
    {"status": 1},
    SimpleNamespace(status="success"),
    SimpleNamespace(status="complete"),
]
FAILED_RECEIPTS = [
    AttributeDict({"status": 0}),
    {"status": 0},
    SimpleNamespace(status="reverted"),
    SimpleNamespace(status="failed"),
]
UNCONFIRMED_RECEIPTS = [
    {},
    {"status": None},
    SimpleNamespace(status="pending"),
    None,
]


def run_transfer(mock_wallet):
    """Run a transfer whose token lookups succeed."""
    with patch(
        "coinbase_agentkit.action_providers.erc20.erc20_action_provider.get_token_details"
    ) as mock_get_token_details:
        # Source token details, then None because the destination is not an ERC20 token
        mock_get_token_details.side_effect = [create_token_details(), None]
        return erc20_action_provider().transfer(mock_wallet, TRANSFER_ARGS)


def run_approve(mock_wallet):
    """Run an approval whose token lookup succeeds."""
    with patch(
        "coinbase_agentkit.action_providers.erc20.erc20_action_provider.get_token_details"
    ) as mock_get_token_details:
        mock_get_token_details.return_value = create_token_details()
        return erc20_action_provider().approve(mock_wallet, APPROVE_ARGS)


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

    with patch(
        "coinbase_agentkit.action_providers.erc20.erc20_action_provider.get_token_details"
    ) as mock_get_token_details:
        mock_get_token_details.return_value = create_token_details()
        response = provider.get_balance(mock_wallet, args)

    # Verify get_token_details was called
    mock_get_token_details.assert_called_once_with(mock_wallet, MOCK_CONTRACT_ADDRESS, None)

    # Verify response includes token name and formatted balance
    expected_balance = int(MOCK_AMOUNT) / 10**MOCK_DECIMALS
    assert MOCK_TOKEN_NAME in response
    assert MOCK_CONTRACT_ADDRESS in response
    assert str(expected_balance) in response


def test_get_balance_error(mock_wallet):
    """Test get_balance with error."""
    args = {"contract_address": MOCK_CONTRACT_ADDRESS}
    provider = erc20_action_provider()

    with patch(
        "coinbase_agentkit.action_providers.erc20.erc20_action_provider.get_token_details"
    ) as mock_get_token_details:
        # Simulate failure to get token details
        mock_get_token_details.return_value = None
        response = provider.get_balance(mock_wallet, args)

    # Verify error message
    assert "Error" in response
    assert "Could not fetch token details" in response


def test_transfer_schema_valid():
    """Test that the TransferSchema validates correctly."""
    valid_input = {
        "amount": MOCK_AMOUNT,
        "contract_address": MOCK_CONTRACT_ADDRESS,
        "destination_address": MOCK_DESTINATION,
    }
    schema = TransferSchema(**valid_input)
    assert schema.amount == MOCK_AMOUNT
    assert schema.contract_address == MOCK_CONTRACT_ADDRESS
    assert schema.destination_address == MOCK_DESTINATION


def test_transfer_schema_invalid():
    """Test that the TransferSchema fails on invalid input."""
    with pytest.raises(ValueError):
        TransferSchema()


def test_transfer_success(mock_wallet):
    """Test successful transfer call."""
    args = {
        "amount": "1.5",  # Use a reasonable amount in whole units
        "contract_address": MOCK_CONTRACT_ADDRESS,
        "destination_address": MOCK_DESTINATION,
    }
    provider = erc20_action_provider()

    mock_tx_hash = "0xghijkl987654321"
    mock_wallet.send_transaction.return_value = mock_tx_hash
    mock_wallet.wait_for_transaction_receipt.return_value = AttributeDict({"status": 1})

    with patch(
        "coinbase_agentkit.action_providers.erc20.erc20_action_provider.get_token_details"
    ) as mock_get_token_details:
        # First call: get token details for source token
        # Second call: check if destination is an ERC20 token (should return None for EOA)
        mock_get_token_details.side_effect = [
            create_token_details(),
            None,  # Destination is not an ERC20 token
        ]

        response = provider.transfer(mock_wallet, args)

    # Calculate expected amount in atomic units
    amount_in_atomic = int(float(args["amount"]) * (10**MOCK_DECIMALS))

    contract = Web3().eth.contract(
        address=Web3().to_checksum_address(MOCK_CONTRACT_ADDRESS), abi=ERC20_ABI
    )
    expected_data = contract.encode_abi(
        "transfer", [Web3().to_checksum_address(MOCK_DESTINATION), amount_in_atomic]
    )

    mock_wallet.send_transaction.assert_called_once_with(
        {
            "to": Web3().to_checksum_address(MOCK_CONTRACT_ADDRESS),
            "data": expected_data,
        }
    )
    mock_wallet.wait_for_transaction_receipt.assert_called_once_with(mock_tx_hash)
    assert f"Transferred {args['amount']}" in response
    assert MOCK_TOKEN_NAME in response
    assert MOCK_DESTINATION in response
    assert f"Transaction hash for the transfer: {mock_tx_hash}" in response


def test_transfer_error(mock_wallet):
    """Test transfer with error."""
    args = {
        "amount": "1.5",  # Use a reasonable amount in whole units
        "contract_address": MOCK_CONTRACT_ADDRESS,
        "destination_address": MOCK_DESTINATION,
    }
    error = Exception("Failed to execute transfer")

    provider = erc20_action_provider()
    mock_wallet.send_transaction.side_effect = error

    with patch(
        "coinbase_agentkit.action_providers.erc20.erc20_action_provider.get_token_details"
    ) as mock_get_token_details:
        # First call: get token details for source token
        # Second call: check if destination is an ERC20 token (should return None for EOA)
        mock_get_token_details.side_effect = [
            create_token_details(),
            None,  # Destination is not an ERC20 token
        ]

        response = provider.transfer(mock_wallet, args)

    # Calculate expected amount in atomic units
    amount_in_atomic = int(float(args["amount"]) * (10**MOCK_DECIMALS))

    contract = Web3().eth.contract(
        address=Web3().to_checksum_address(MOCK_CONTRACT_ADDRESS), abi=ERC20_ABI
    )
    expected_data = contract.encode_abi(
        "transfer", [Web3().to_checksum_address(MOCK_DESTINATION), amount_in_atomic]
    )

    mock_wallet.send_transaction.assert_called_once_with(
        {
            "to": Web3().to_checksum_address(MOCK_CONTRACT_ADDRESS),
            "data": expected_data,
        }
    )
    assert f"Error transferring the asset: {error!s}" in response


@pytest.mark.parametrize("receipt", SUCCEEDED_RECEIPTS)
def test_transfer_reports_success_for_each_receipt_vocabulary(mock_wallet, receipt):
    """Test that every known success status is reported as a transfer."""
    mock_wallet.send_transaction.return_value = "0xtransferhash"
    mock_wallet.wait_for_transaction_receipt.return_value = receipt

    response = run_transfer(mock_wallet)

    assert response.startswith(f"Transferred {TRANSFER_ARGS['amount']}")
    assert "Transaction hash for the transfer: 0xtransferhash" in response


@pytest.mark.parametrize("receipt", FAILED_RECEIPTS)
def test_transfer_reverted_is_not_reported_as_transferred(mock_wallet, receipt):
    """Test that a mined transfer that reverted is reported as failed."""
    mock_wallet.send_transaction.return_value = "0xtransferhash"
    mock_wallet.wait_for_transaction_receipt.return_value = receipt

    response = run_transfer(mock_wallet)

    assert response.startswith("Error:")
    assert "failed on chain" in response
    assert "no tokens were transferred" in response
    assert "Transaction hash for the transfer: 0xtransferhash" in response
    assert "Transferred" not in response


@pytest.mark.parametrize("receipt", UNCONFIRMED_RECEIPTS)
def test_transfer_unknown_receipt_status_is_unconfirmed(mock_wallet, receipt):
    """Test that a receipt that does not say success is not reported as a transfer."""
    mock_wallet.send_transaction.return_value = "0xtransferhash"
    mock_wallet.wait_for_transaction_receipt.return_value = receipt

    response = run_transfer(mock_wallet)

    assert "does not confirm success" in response
    assert "Transaction hash for the transfer: 0xtransferhash" in response
    assert "Do not send this transfer again" in response
    assert "Transferred" not in response
    assert not response.startswith("Error")


def test_transfer_receipt_lookup_failure_is_sent_not_failed(mock_wallet):
    """Test that a failed receipt lookup after sending is not reported as an error."""
    mock_wallet.send_transaction.return_value = "0xtransferhash"
    mock_wallet.wait_for_transaction_receipt.side_effect = Exception("RPC timed out")

    response = run_transfer(mock_wallet)

    mock_wallet.send_transaction.assert_called_once()
    assert "was sent, but its receipt could not be confirmed yet (RPC timed out)" in response
    assert "Transaction hash for the transfer: 0xtransferhash" in response
    assert "Do not send this transfer again" in response
    assert "Transferred" not in response
    assert not response.startswith("Error")


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


def test_approve_schema_valid():
    """Test that the ApproveSchema validates correctly."""
    valid_input = {
        "amount": "100",
        "contract_address": MOCK_CONTRACT_ADDRESS,
        "spender_address": MOCK_SPENDER,
    }
    schema = ApproveSchema(**valid_input)
    assert schema.amount == "100"
    assert schema.contract_address == MOCK_CONTRACT_ADDRESS
    assert schema.spender_address == MOCK_SPENDER


def test_approve_schema_invalid():
    """Test that the ApproveSchema fails on invalid input."""
    with pytest.raises(ValueError):
        ApproveSchema()


def test_approve_schema_negative_amount():
    """Test that the ApproveSchema validates amount >= 0."""
    invalid_input = {
        "amount": "-1",
        "contract_address": MOCK_CONTRACT_ADDRESS,
        "spender_address": MOCK_SPENDER,
    }
    with pytest.raises(ValueError):
        ApproveSchema(**invalid_input)


def test_approve_success(mock_wallet):
    """Test successful approve call."""
    args = {
        "amount": "100",
        "contract_address": MOCK_CONTRACT_ADDRESS,
        "spender_address": MOCK_SPENDER,
    }
    provider = erc20_action_provider()

    mock_tx_hash = "0xapprove123456789"
    mock_wallet.send_transaction.return_value = mock_tx_hash
    mock_wallet.wait_for_transaction_receipt.return_value = AttributeDict({"status": 1})

    with patch(
        "coinbase_agentkit.action_providers.erc20.erc20_action_provider.get_token_details"
    ) as mock_get_token_details:
        mock_get_token_details.return_value = create_token_details()

        response = provider.approve(mock_wallet, args)

    # Calculate expected amount in atomic units
    amount_in_atomic = int(float(args["amount"]) * (10**MOCK_DECIMALS))

    contract = Web3().eth.contract(
        address=Web3().to_checksum_address(MOCK_CONTRACT_ADDRESS), abi=ERC20_ABI
    )
    expected_data = contract.encode_abi(
        "approve", [Web3().to_checksum_address(MOCK_SPENDER), amount_in_atomic]
    )

    mock_wallet.send_transaction.assert_called_once_with(
        {
            "to": Web3().to_checksum_address(MOCK_CONTRACT_ADDRESS),
            "data": expected_data,
        }
    )
    mock_wallet.wait_for_transaction_receipt.assert_called_once_with(mock_tx_hash)
    assert f"Approved {args['amount']} {MOCK_TOKEN_NAME}" in response
    assert MOCK_CONTRACT_ADDRESS in response
    assert MOCK_SPENDER in response
    assert f"Transaction hash: {mock_tx_hash}" in response


def test_approve_error_no_token_details(mock_wallet):
    """Test approve with error when token details cannot be fetched."""
    args = {
        "amount": "100",
        "contract_address": MOCK_CONTRACT_ADDRESS,
        "spender_address": MOCK_SPENDER,
    }
    provider = erc20_action_provider()

    with patch(
        "coinbase_agentkit.action_providers.erc20.erc20_action_provider.get_token_details"
    ) as mock_get_token_details:
        # Simulate failure to get token details
        mock_get_token_details.return_value = None
        response = provider.approve(mock_wallet, args)

    # Verify error message
    assert "Error" in response
    assert "Could not fetch token details" in response


def test_approve_error_transaction_fails(mock_wallet):
    """Test approve with error when transaction fails."""
    args = {
        "amount": "100",
        "contract_address": MOCK_CONTRACT_ADDRESS,
        "spender_address": MOCK_SPENDER,
    }
    error = Exception("Transaction failed")

    provider = erc20_action_provider()
    mock_wallet.send_transaction.side_effect = error

    with patch(
        "coinbase_agentkit.action_providers.erc20.erc20_action_provider.get_token_details"
    ) as mock_get_token_details:
        mock_get_token_details.return_value = create_token_details()

        response = provider.approve(mock_wallet, args)

    assert f"Error approving tokens: {error!s}" in response


@pytest.mark.parametrize("receipt", SUCCEEDED_RECEIPTS)
def test_approve_reports_success_for_each_receipt_vocabulary(mock_wallet, receipt):
    """Test that every known success status is reported as an approval."""
    mock_wallet.send_transaction.return_value = "0xapprovehash"
    mock_wallet.wait_for_transaction_receipt.return_value = receipt

    response = run_approve(mock_wallet)

    assert response.startswith(f"Approved {APPROVE_ARGS['amount']} {MOCK_TOKEN_NAME}")
    assert "Transaction hash: 0xapprovehash" in response


@pytest.mark.parametrize("receipt", FAILED_RECEIPTS)
def test_approve_reverted_is_not_reported_as_approved(mock_wallet, receipt):
    """Test that a mined approval that reverted is reported as failed."""
    mock_wallet.send_transaction.return_value = "0xapprovehash"
    mock_wallet.wait_for_transaction_receipt.return_value = receipt

    response = run_approve(mock_wallet)

    assert response.startswith("Error:")
    assert "failed on chain" in response
    assert "the allowance was not changed" in response
    assert "Transaction hash: 0xapprovehash" in response
    assert "Approved" not in response


@pytest.mark.parametrize("receipt", UNCONFIRMED_RECEIPTS)
def test_approve_unknown_receipt_status_is_unconfirmed(mock_wallet, receipt):
    """Test that a receipt that does not say success is not reported as an approval."""
    mock_wallet.send_transaction.return_value = "0xapprovehash"
    mock_wallet.wait_for_transaction_receipt.return_value = receipt

    response = run_approve(mock_wallet)

    assert "does not confirm success" in response
    assert "Transaction hash: 0xapprovehash" in response
    assert "Do not send this approval again" in response
    assert "Approved" not in response
    assert not response.startswith("Error")


def test_approve_receipt_lookup_failure_is_sent_not_failed(mock_wallet):
    """Test that a failed receipt lookup after sending is not reported as an error."""
    mock_wallet.send_transaction.return_value = "0xapprovehash"
    mock_wallet.wait_for_transaction_receipt.side_effect = Exception("RPC timed out")

    response = run_approve(mock_wallet)

    mock_wallet.send_transaction.assert_called_once()
    assert "was sent, but its receipt could not be confirmed yet (RPC timed out)" in response
    assert "Transaction hash: 0xapprovehash" in response
    assert "Do not send this approval again" in response
    assert "Approved" not in response
    assert not response.startswith("Error")


def test_allowance_schema_valid():
    """Test that the AllowanceSchema validates correctly."""
    valid_input = {
        "contract_address": MOCK_CONTRACT_ADDRESS,
        "spender_address": MOCK_SPENDER,
    }
    schema = AllowanceSchema(**valid_input)
    assert schema.contract_address == MOCK_CONTRACT_ADDRESS
    assert schema.spender_address == MOCK_SPENDER


def test_allowance_schema_invalid():
    """Test that the AllowanceSchema fails on invalid input."""
    with pytest.raises(ValueError):
        AllowanceSchema()


def test_get_allowance_success(mock_wallet):
    """Test successful get_allowance call."""
    args = {
        "contract_address": MOCK_CONTRACT_ADDRESS,
        "spender_address": MOCK_SPENDER,
    }
    provider = erc20_action_provider()

    allowance_amount = 100 * (10**MOCK_DECIMALS)
    mock_wallet.read_contract.return_value = allowance_amount

    with patch(
        "coinbase_agentkit.action_providers.erc20.erc20_action_provider.get_token_details"
    ) as mock_get_token_details:
        mock_get_token_details.return_value = create_token_details()

        response = provider.get_allowance(mock_wallet, args)

    # Verify read_contract was called
    mock_wallet.read_contract.assert_called_once()
    call_args = mock_wallet.read_contract.call_args[1]
    assert call_args["contract_address"] == Web3().to_checksum_address(MOCK_CONTRACT_ADDRESS)
    assert call_args["function_name"] == "allowance"

    # Verify response includes token name and formatted allowance
    expected_allowance = allowance_amount / 10**MOCK_DECIMALS
    assert MOCK_TOKEN_NAME in response
    assert MOCK_CONTRACT_ADDRESS in response
    assert MOCK_SPENDER in response
    assert str(expected_allowance) in response


def test_get_allowance_error_no_token_details(mock_wallet):
    """Test get_allowance with error when token details cannot be fetched."""
    args = {
        "contract_address": MOCK_CONTRACT_ADDRESS,
        "spender_address": MOCK_SPENDER,
    }
    provider = erc20_action_provider()

    with patch(
        "coinbase_agentkit.action_providers.erc20.erc20_action_provider.get_token_details"
    ) as mock_get_token_details:
        # Simulate failure to get token details
        mock_get_token_details.return_value = None
        response = provider.get_allowance(mock_wallet, args)

    # Verify error message
    assert "Error" in response
    assert "Could not fetch token details" in response


def test_get_allowance_error_read_fails(mock_wallet):
    """Test get_allowance with error when read_contract fails."""
    args = {
        "contract_address": MOCK_CONTRACT_ADDRESS,
        "spender_address": MOCK_SPENDER,
    }
    error = Exception("Allowance read failed")

    provider = erc20_action_provider()
    mock_wallet.read_contract.side_effect = error

    with patch(
        "coinbase_agentkit.action_providers.erc20.erc20_action_provider.get_token_details"
    ) as mock_get_token_details:
        mock_get_token_details.return_value = create_token_details()

        response = provider.get_allowance(mock_wallet, args)

    assert f"Error checking allowance: {error!s}" in response
