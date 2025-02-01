from cdp_agentkit_core.actions.get_wallet_details import (
    GetWalletDetailsInput,
    get_wallet_details,
)


def test_get_wallet_details_input_model_valid():
    """Test that GetWalletDetailsInput accepts valid parameters."""
    input_model = GetWalletDetailsInput()

    assert isinstance(input_model, GetWalletDetailsInput)


def test_get_wallet_details_success(wallet_factory):
    """Test successful get wallet details with valid parameters."""
    mock_wallet = wallet_factory()

    action_response = get_wallet_details(mock_wallet)

    expected_response = f"Wallet: {mock_wallet.id} on network: {mock_wallet.network_id} with default address: {mock_wallet.default_address.address_id}"

    assert action_response == expected_response
