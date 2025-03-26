"""Tests for ETH Account Wallet Provider gas estimation."""

from unittest.mock import patch

from .conftest import (
    MOCK_BASE_FEE_PER_GAS,
    MOCK_FEE_MULTIPLIER,
    MOCK_PRIORITY_FEE_WEI,
)

# =========================================================
# gas estimation tests
# =========================================================


def test_estimate_fees(wallet_provider, mock_web3):
    """Test estimate_fees method."""
    with patch.object(wallet_provider, "_fee_per_gas_multiplier", MOCK_FEE_MULTIPLIER):
        max_priority_fee, max_fee = wallet_provider.estimate_fees()

        assert max_fee > max_priority_fee
        assert max_priority_fee == MOCK_PRIORITY_FEE_WEI


def test_estimate_fees_with_multiplier(wallet_provider, mock_web3):
    """Test estimate_fees method with custom fee multiplier."""
    # Setup test conditions
    mock_web3.return_value.eth.get_block.return_value = {"baseFeePerGas": MOCK_BASE_FEE_PER_GAS}
    custom_fee_multiplier = 2.0

    # The implementation converts 0.1 gwei to wei, which should be 100000000 wei
    # Mock Web3.to_wei to return this value for '0.1 gwei'
    mock_web3.to_wei.return_value = 100000000  # 0.1 gwei in wei
    expected_priority_fee = int(100000000 * custom_fee_multiplier)  # 200000000 wei

    # Set the fee multiplier on the wallet provider instance
    with patch.object(wallet_provider, "_fee_per_gas_multiplier", custom_fee_multiplier):
        max_priority_fee, max_fee = wallet_provider.estimate_fees()

        # Verify results
        assert max_priority_fee == expected_priority_fee
        assert max_fee > max_priority_fee
        # The max fee should be at least (base_fee * 2) + priority_fee based on EIP-1559
        assert max_fee >= (MOCK_BASE_FEE_PER_GAS * 2) + max_priority_fee

        # Verify the Web3 method calls
        mock_web3.return_value.eth.get_block.assert_called_once_with("latest")
        mock_web3.to_wei.assert_called_once_with(0.1, "gwei")
