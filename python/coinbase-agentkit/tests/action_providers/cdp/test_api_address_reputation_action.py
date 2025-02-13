"""Tests for CDP API address reputation action."""

from cdp.address_reputation import (
    AddressReputation,
    AddressReputationMetadata,
    AddressReputationModel,
)

from coinbase_agentkit.action_providers.cdp.cdp_api_action_provider import (
    AddressReputationSchema,
    cdp_api_action_provider,
)

from .conftest import (
    MOCK_MAINNET_NETWORK_ID,
    MOCK_WALLET_ADDRESS,
)


def test_address_reputation_input():
    """Test that AddressReputationInput accepts address and network parameters."""
    input_model = AddressReputationSchema(
        address=MOCK_WALLET_ADDRESS, network=MOCK_MAINNET_NETWORK_ID
    )
    assert input_model.address == MOCK_WALLET_ADDRESS
    assert input_model.network == MOCK_MAINNET_NETWORK_ID


def test_address_reputation_action(mock_env, mock_cdp_imports):
    """Test the address reputation action."""
    _, mock_external_address = mock_cdp_imports

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
    expected_response = f"Address {MOCK_WALLET_ADDRESS} reputation: {mock_reputation}"

    mock_external_address.return_value.reputation.return_value = mock_reputation

    response = cdp_api_action_provider().address_reputation(
        {"address": MOCK_WALLET_ADDRESS, "network": MOCK_MAINNET_NETWORK_ID}
    )
    assert response == expected_response


def test_address_reputation_action_error(mock_env, mock_cdp_imports):
    """Test the address reputation action with an error."""
    _, mock_external_address = mock_cdp_imports

    mock_external_address.return_value.reputation.side_effect = Exception(
        "Error checking reputation"
    )
    response = cdp_api_action_provider().address_reputation(
        {"address": MOCK_WALLET_ADDRESS, "network": MOCK_MAINNET_NETWORK_ID}
    )
    assert response == "Error checking address reputation: Error checking reputation"
