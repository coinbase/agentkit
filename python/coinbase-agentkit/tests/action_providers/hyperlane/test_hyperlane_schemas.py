import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.hyperlane.schemas import (
    HyperlaneQuoteGasSchema,
    HyperlaneTransferRemoteSchema,
)


def test_transfer_remote_schema_valid():
    """All required fields produce a valid schema."""
    schema = HyperlaneTransferRemoteSchema(
        warp_route_address="0x2222222222222222222222222222222222222222",
        destination="optimism",
        recipient="0x4444444444444444444444444444444444444444",
        amount="100",
        token_address="0x3333333333333333333333333333333333333333",
    )
    assert schema.destination == "optimism"
    assert schema.amount == "100"


def test_transfer_remote_schema_missing_field():
    """Omitting any required field raises ValidationError."""
    with pytest.raises(ValidationError):
        HyperlaneTransferRemoteSchema(
            warp_route_address="0x2",
            destination="optimism",
            recipient="0x4",
            amount="100",
        )

    with pytest.raises(ValidationError):
        HyperlaneTransferRemoteSchema(
            destination="optimism",
            recipient="0x4",
            amount="100",
            token_address="0x3",
        )


def test_quote_gas_schema_valid():
    """All required fields produce a valid quote schema."""
    schema = HyperlaneQuoteGasSchema(
        warp_route_address="0x2222222222222222222222222222222222222222",
        destination="ethereum",
    )
    assert schema.destination == "ethereum"


def test_quote_gas_schema_missing_field():
    """Omitting any required field raises ValidationError."""
    with pytest.raises(ValidationError):
        HyperlaneQuoteGasSchema(destination="ethereum")

    with pytest.raises(ValidationError):
        HyperlaneQuoteGasSchema(warp_route_address="0x2")
