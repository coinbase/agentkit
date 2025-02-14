"""Tests for Superfluid action provider."""

from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.superfluid.constants import (
    CREATE_ABI,
    DELETE_ABI,
    SUPERFLUID_HOST_ADDRESS,
    UPDATE_ABI,
)
from coinbase_agentkit.action_providers.superfluid.schemas import (
    CreateFlowSchema,
    DeleteFlowSchema,
    UpdateFlowSchema,
)
from coinbase_agentkit.action_providers.superfluid.superfluid_action_provider import (
    SuperfluidActionProvider,
)
from coinbase_agentkit.network import Network

MOCK_TX_HASH = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
MOCK_RECEIPT = {"status": 1, "transactionHash": MOCK_TX_HASH}
MOCK_ADDRESS = "0xmockWalletAddress"


def test_create_flowinput_model_valid():
    """Test that CreateFlowInput schema accepts valid parameters."""
    valid_input = {
        "recipient": "0xRecipientAddress",
        "token_address": "0xTokenAddress",
        "flow_rate": "1000",
    }
    input_model = CreateFlowSchema(**valid_input)

    assert isinstance(input_model, CreateFlowSchema)
    assert input_model.recipient == valid_input["recipient"]
    assert input_model.token_address == valid_input["token_address"]
    assert input_model.flow_rate == valid_input["flow_rate"]


def test_create_flow_input_model_missing_params():
    """Test that CreateFlowInput schema raises error when params are missing."""
    with pytest.raises(ValidationError):
        CreateFlowSchema()


def test_update_flow_input_model_valid():
    """Test that UpdateFlowInput schema accepts valid parameters."""
    valid_input = {
        "recipient": "0xRecipientAddress",
        "token_address": "0xTokenAddress",
        "new_flow_rate": "2000",
    }
    input_model = UpdateFlowSchema(**valid_input)

    assert isinstance(input_model, UpdateFlowSchema)
    assert input_model.recipient == valid_input["recipient"]
    assert input_model.token_address == valid_input["token_address"]
    assert input_model.new_flow_rate == valid_input["new_flow_rate"]


def test_update_flow_input_model_missing_params():
    """Test that UpdateFlowInput schema raises error when params are missing."""
    with pytest.raises(ValidationError):
        UpdateFlowSchema()


def test_delete_flow_input_model_valid():
    """Test that DeleteFlowInput schema accepts valid parameters."""
    valid_input = {"recipient": "0xRecipientAddress", "token_address": "0xTokenAddress"}
    input_model = DeleteFlowSchema(**valid_input)

    assert isinstance(input_model, DeleteFlowSchema)
    assert input_model.recipient == valid_input["recipient"]
    assert input_model.token_address == valid_input["token_address"]


def test_delete_flow_input_model_missing_params():
    """Test that DeleteFlowInput schema raises error when params are missing."""
    with pytest.raises(ValidationError):
        DeleteFlowSchema()


def test_create_flow_success():
    """Test successful flow creation."""
    with (
        patch(
            "coinbase_agentkit.action_providers.superfluid.superfluid_action_provider.Web3"
        ) as mock_web3,
    ):
        mock_contract = mock_web3.return_value.eth.contract.return_value
        mock_contract.encode_abi.return_value = "0xencoded"
        mock_wallet = MagicMock()
        mock_wallet.send_transaction.return_value = MOCK_TX_HASH
        mock_wallet.wait_for_transaction_receipt.return_value = MOCK_RECEIPT
        mock_wallet.get_address.return_value = MOCK_ADDRESS

        provider = SuperfluidActionProvider()
        args = {
            "recipient": "0xRecipientAddress",
            "token_address": "0xTokenAddress",
            "flow_rate": "1000",
        }
        response = provider.create_flow(mock_wallet, args)

        expected_response = f"Flow created successfully. Transaction hash: {MOCK_TX_HASH}"
        assert response == expected_response

        mock_web3.return_value.eth.contract.assert_called_once_with(
            address=SUPERFLUID_HOST_ADDRESS,
            abi=CREATE_ABI,
        )

        mock_contract.encode_abi.assert_called_once_with(
            "createFlow", args=["0xTokenAddress", MOCK_ADDRESS, "0xRecipientAddress", 1000, "0x"]
        )

        mock_wallet.send_transaction.assert_called_once()
        tx = mock_wallet.send_transaction.call_args[0][0]
        assert tx["to"] == SUPERFLUID_HOST_ADDRESS
        assert tx["data"] == "0xencoded"

        mock_wallet.wait_for_transaction_receipt.assert_called_once_with(MOCK_TX_HASH)


def test_update_flow_success():
    """Test successful flow update."""
    with (
        patch(
            "coinbase_agentkit.action_providers.superfluid.superfluid_action_provider.Web3"
        ) as mock_web3,
    ):
        mock_contract = mock_web3.return_value.eth.contract.return_value
        mock_contract.encode_abi.return_value = "0xencoded"
        mock_wallet = MagicMock()
        mock_wallet.send_transaction.return_value = MOCK_TX_HASH
        mock_wallet.wait_for_transaction_receipt.return_value = MOCK_RECEIPT
        mock_wallet.get_address.return_value = MOCK_ADDRESS

        provider = SuperfluidActionProvider()
        args = {
            "recipient": "0xRecipientAddress",
            "token_address": "0xTokenAddress",
            "new_flow_rate": "2000",
        }
        response = provider.update_flow(mock_wallet, args)

        expected_response = f"Flow updated successfully. Transaction hash: {MOCK_TX_HASH}"
        assert response == expected_response

        mock_web3.return_value.eth.contract.assert_called_once_with(
            address=SUPERFLUID_HOST_ADDRESS,
            abi=UPDATE_ABI,
        )

        mock_contract.encode_abi.assert_called_once_with(
            "updateFlow",
            args=[
                "0xTokenAddress",
                MOCK_ADDRESS,
                "0xRecipientAddress",
                2000,
                "0x",
            ],
        )

        mock_wallet.send_transaction.assert_called_once()
        tx = mock_wallet.send_transaction.call_args[0][0]
        assert tx["to"] == SUPERFLUID_HOST_ADDRESS
        assert tx["data"] == "0xencoded"

        mock_wallet.wait_for_transaction_receipt.assert_called_once_with(MOCK_TX_HASH)


def test_delete_flow_success():
    """Test successful flow deletion."""
    with (
        patch(
            "coinbase_agentkit.action_providers.superfluid.superfluid_action_provider.Web3"
        ) as mock_web3,
    ):
        mock_contract = mock_web3.return_value.eth.contract.return_value
        mock_contract.encode_abi.return_value = "0xencoded"
        mock_wallet = MagicMock()
        mock_wallet.send_transaction.return_value = MOCK_TX_HASH
        mock_wallet.wait_for_transaction_receipt.return_value = MOCK_RECEIPT
        mock_wallet.get_address.return_value = MOCK_ADDRESS

        provider = SuperfluidActionProvider()
        args = {"recipient": "0xRecipientAddress", "token_address": "0xTokenAddress"}
        response = provider.delete_flow(mock_wallet, args)

        expected_response = f"Flow deleted successfully. Transaction hash: {MOCK_TX_HASH}"
        assert response == expected_response

        mock_web3.return_value.eth.contract.assert_called_once_with(
            address=SUPERFLUID_HOST_ADDRESS,
            abi=DELETE_ABI,
        )

        mock_contract.encode_abi.assert_called_once_with(
            "deleteFlow",
            args=[
                "0xTokenAddress",
                MOCK_ADDRESS,
                "0xRecipientAddress",
                "0x",
            ],
        )

        mock_wallet.send_transaction.assert_called_once()
        tx = mock_wallet.send_transaction.call_args[0][0]
        assert tx["to"] == SUPERFLUID_HOST_ADDRESS
        assert tx["data"] == "0xencoded"

        mock_wallet.wait_for_transaction_receipt.assert_called_once_with(MOCK_TX_HASH)


def test_create_flow_error():
    """Test flow creation when transaction fails."""
    with (
        patch(
            "coinbase_agentkit.action_providers.superfluid.superfluid_action_provider.Web3"
        ) as mock_web3,
    ):
        mock_contract = mock_web3.return_value.eth.contract.return_value
        mock_contract.encode_abi.return_value = "0xencoded"
        mock_wallet = MagicMock()
        mock_wallet.get_address.return_value = MOCK_ADDRESS
        mock_wallet.send_transaction.side_effect = Exception("Transaction failed")

        provider = SuperfluidActionProvider()
        args = {
            "recipient": "0xRecipientAddress",
            "token_address": "0xTokenAddress",
            "flow_rate": "1000",
        }

        response = provider.create_flow(mock_wallet, args)

        expected_response = "Error creating flow: Transaction failed"
        assert response == expected_response

        mock_web3.return_value.eth.contract.assert_called_once_with(
            address=SUPERFLUID_HOST_ADDRESS,
            abi=CREATE_ABI,
        )

        mock_contract.encode_abi.assert_called_once_with(
            "createFlow", args=["0xTokenAddress", MOCK_ADDRESS, "0xRecipientAddress", 1000, "0x"]
        )

        mock_wallet.send_transaction.assert_called_once()
        tx = mock_wallet.send_transaction.call_args[0][0]
        assert tx["to"] == SUPERFLUID_HOST_ADDRESS
        assert tx["data"] == "0xencoded"


def test_update_flow_error():
    """Test flow update when transaction fails."""
    with (
        patch(
            "coinbase_agentkit.action_providers.superfluid.superfluid_action_provider.Web3"
        ) as mock_web3,
    ):
        mock_contract = mock_web3.return_value.eth.contract.return_value
        mock_contract.encode_abi.return_value = "0xencoded"
        mock_wallet = MagicMock()
        mock_wallet.get_address.return_value = MOCK_ADDRESS
        mock_wallet.send_transaction.side_effect = Exception("Transaction failed")

        provider = SuperfluidActionProvider()
        args = {
            "recipient": "0xRecipientAddress",
            "token_address": "0xTokenAddress",
            "new_flow_rate": "2000",
        }
        response = provider.update_flow(mock_wallet, args)

        expected_response = "Error updating flow: Transaction failed"
        assert response == expected_response

        mock_web3.return_value.eth.contract.assert_called_once_with(
            address=SUPERFLUID_HOST_ADDRESS,
            abi=UPDATE_ABI,
        )

        mock_contract.encode_abi.assert_called_once_with(
            "updateFlow",
            args=[
                "0xTokenAddress",
                MOCK_ADDRESS,
                "0xRecipientAddress",
                2000,
                "0x",
            ],
        )

        mock_wallet.send_transaction.assert_called_once()
        tx = mock_wallet.send_transaction.call_args[0][0]
        assert tx["to"] == SUPERFLUID_HOST_ADDRESS
        assert tx["data"] == "0xencoded"


def test_delete_flow_error():
    """Test flow deletion when transaction fails."""
    with (
        patch(
            "coinbase_agentkit.action_providers.superfluid.superfluid_action_provider.Web3"
        ) as mock_web3,
    ):
        mock_contract = mock_web3.return_value.eth.contract.return_value
        mock_contract.encode_abi.return_value = "0xencoded"
        mock_wallet = MagicMock()
        mock_wallet.get_address.return_value = MOCK_ADDRESS
        mock_wallet.send_transaction.side_effect = Exception("Transaction failed")

        provider = SuperfluidActionProvider()
        args = {"recipient": "0xRecipientAddress", "token_address": "0xTokenAddress"}
        response = provider.delete_flow(mock_wallet, args)

        expected_response = "Error deleting flow: Transaction failed"
        assert response == expected_response

        mock_web3.return_value.eth.contract.assert_called_once_with(
            address=SUPERFLUID_HOST_ADDRESS,
            abi=DELETE_ABI,
        )

        mock_contract.encode_abi.assert_called_once_with(
            "deleteFlow",
            args=[
                "0xTokenAddress",
                MOCK_ADDRESS,
                "0xRecipientAddress",
                "0x",
            ],
        )

        mock_wallet.send_transaction.assert_called_once()
        tx = mock_wallet.send_transaction.call_args[0][0]
        assert tx["to"] == SUPERFLUID_HOST_ADDRESS
        assert tx["data"] == "0xencoded"


def test_supports_network():
    """Test network support validation."""
    provider = SuperfluidActionProvider()

    test_cases = [
        ("base-mainnet", "8453", "evm", True),
        ("base-sepolia", "84532", "evm", True),
        ("ethereum-mainnet", "1", "evm", True),
        ("arbitrum-one", "42161", "evm", True),
        ("optimism", "10", "evm", True),
        ("base-goerli", "84531", "evm", True),
        ("mainnet", None, "bitcoin", False),
        ("mainnet", None, "solana", False),
    ]

    for network_id, chain_id, protocol_family, expected_result in test_cases:
        network = Network(protocol_family=protocol_family, chain_id=chain_id, network_id=network_id)
        result = provider.supports_network(network)
        assert (
            result is expected_result
        ), f"Network {network_id} (chain_id: {chain_id}) should{' ' if expected_result else ' not '}be supported"


def test_action_provider_initialization():
    """Test action provider initialization."""
    provider = SuperfluidActionProvider()
    assert provider.name == "superfluid"
    assert provider.action_providers == []
