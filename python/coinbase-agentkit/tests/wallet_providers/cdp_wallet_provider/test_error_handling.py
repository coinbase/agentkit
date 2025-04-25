"""Tests for CDP Wallet Provider error handling."""

from decimal import Decimal
from unittest.mock import patch

import pytest

# =========================================================
# error handling tests
# =========================================================


def test_network_error_handling(mocked_wallet_provider, mock_wallet):
    """Test handling of network errors during transactions."""
    mock_wallet.transfer.side_effect = Exception("Network connection error")

    with pytest.raises(Exception, match="Failed to transfer native tokens"):
        mocked_wallet_provider.native_transfer("0x1234", Decimal("0.5"))

    with (
        patch.object(
            mocked_wallet_provider._web3.eth,
            "contract",
            side_effect=Exception("Contract read error"),
        ),
        pytest.raises(Exception, match="Contract read error"),
    ):
        mocked_wallet_provider.read_contract(
            "0x1234",
            [
                {
                    "name": "test",
                    "type": "function",
                    "inputs": [],
                    "outputs": [{"type": "string"}],
                }
            ],
            "test",
        )

    with (
        patch.object(
            mocked_wallet_provider._web3.eth,
            "wait_for_transaction_receipt",
            side_effect=Exception("Timeout waiting for receipt"),
        ),
        pytest.raises(Exception, match="Timeout waiting for receipt"),
    ):
        mocked_wallet_provider.wait_for_transaction_receipt("0x1234")


def test_comprehensive_error_handling(mocked_wallet_provider, mock_wallet, mock_web3):
    """Test comprehensive error handling for various scenarios."""
    with (
        patch(
            "coinbase_agentkit.wallet_providers.cdp_wallet_provider.Web3.to_checksum_address"
        ) as mock_to_checksum,
        pytest.raises(Exception, match="Failed to transfer native tokens"),
    ):
        mock_to_checksum.side_effect = Exception("Invalid address")
        mocked_wallet_provider.native_transfer("invalid_address", Decimal("1.0"))

    with (
        patch.object(mock_web3.return_value.eth, "contract") as mock_contract_fn,
        pytest.raises(Exception, match="Invalid ABI"),
    ):
        mock_contract_fn.side_effect = Exception("Invalid ABI")
        mocked_wallet_provider.read_contract("0x1234", "invalid_abi", "test")

    with (
        patch.object(mock_wallet, "deploy_contract") as mock_deploy,
        pytest.raises(Exception, match="Invalid constructor arguments"),
    ):
        mock_deploy.side_effect = Exception("Invalid constructor arguments")
        mocked_wallet_provider.deploy_contract("0.8.9", "{}", "TestContract", {"invalid": "args"})
