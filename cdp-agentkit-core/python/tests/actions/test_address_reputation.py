from unittest.mock import patch

import pytest
from cdp.address_reputation import (
    AddressReputation,
    AddressReputationMetadata,
    AddressReputationModel,
)

from cdp_agentkit_core.actions.address_reputation import (
    AddressReputationAction,
    AddressReputationInput,
    check_address_reputation,
)

MOCK_ADDRESS = "0x1234567890123456789012345678901234567890"
MOCK_NETWORK = "base-sepolia"


def test_address_reputation_action_initialization():
    """Test AddressReputationAction initialization and attributes."""
    action = AddressReputationAction()

    assert action.name == "address_reputation"
    assert action.args_schema == AddressReputationInput
    assert callable(action.func)


def test_address_reputation_input_model_valid():
    """Test AddressReputationInput accepts valid parameters."""
    valid_input = AddressReputationInput(
        network=MOCK_NETWORK,
        address=MOCK_ADDRESS,
    )
    assert valid_input.network == MOCK_NETWORK
    assert valid_input.address == MOCK_ADDRESS


def test_address_reputation_input_model_missing_params():
    """Test AddressReputationInput raises error when params are missing."""
    with pytest.raises(ValueError):
        AddressReputationInput()


def test_address_reputation_input_model_invalid_address():
    """Test AddressReputationInput raises error with invalid address format."""
    with pytest.raises(ValueError, match="Invalid Ethereum address format"):
        AddressReputationInput(network=MOCK_NETWORK, address="not_an_address")


def test_address_reputation_success():
    """Test successful address reputation check."""
    mock_model = AddressReputationModel(
        score=85,
        metadata=AddressReputationMetadata(
            total_transactions=150,
            unique_days_active=30,
            longest_active_streak=10,
            current_active_streak=5,
            activity_period_days=45,
            token_swaps_performed=20,
            bridge_transactions_performed=5,
            lend_borrow_stake_transactions=10,
            ens_contract_interactions=2,
            smart_contract_deployments=1,
        ),
    )
    mock_reputation = AddressReputation(model=mock_model)

    with patch("cdp_agentkit_core.actions.address_reputation.Address") as mock_address:
        mock_address_instance = mock_address.return_value
        mock_address_instance.reputation.return_value = mock_reputation

        action_response = check_address_reputation(MOCK_ADDRESS, MOCK_NETWORK)
        expected_response = str(mock_reputation)

        mock_address.assert_called_once_with(MOCK_NETWORK, MOCK_ADDRESS)
        mock_address_instance.reputation.assert_called_once()
        assert action_response == expected_response


def test_address_reputation_failure():
    """Test address reputation check failure."""
    with patch("cdp_agentkit_core.actions.address_reputation.Address") as mock_address:
        mock_address_instance = mock_address.return_value
        mock_address_instance.reputation.side_effect = Exception("API error")

        action_response = check_address_reputation(MOCK_ADDRESS, MOCK_NETWORK)
        expected_response = "Error checking address reputation: API error"

        mock_address.assert_called_once_with(MOCK_NETWORK, MOCK_ADDRESS)
        mock_address_instance.reputation.assert_called_once()
        assert action_response == expected_response
