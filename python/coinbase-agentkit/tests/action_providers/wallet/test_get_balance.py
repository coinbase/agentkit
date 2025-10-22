from coinbase_agentkit.action_providers.wallet.schemas import GetBalanceSchema

from .conftest import MOCK_ADDRESS, MOCK_BALANCE


def test_get_balance_schema_valid():
    """Test that GetBalanceSchema is valid with no parameters."""
    schema = GetBalanceSchema()
    assert isinstance(schema, GetBalanceSchema)


def test_get_balance_success(wallet_action_provider, mock_wallet_provider):
    """Test successful get balance."""
    result = wallet_action_provider.get_balance(mock_wallet_provider, GetBalanceSchema())
    expected = f"Native balance at address {MOCK_ADDRESS}: {MOCK_BALANCE}"
    assert result == expected


def test_get_balance_error(wallet_action_provider, mock_wallet_provider):
    """Test error handling in get balance."""
    error_message = "Failed to get balance"
    mock_wallet_provider.get_balance.side_effect = Exception(error_message)

    result = wallet_action_provider.get_balance(mock_wallet_provider, GetBalanceSchema())
    assert result == f"Error getting balance: {error_message}"
