"""Tests for BlockRun get_usdc_balance action."""

import json
from unittest.mock import MagicMock, patch

from coinbase_agentkit.action_providers.blockrun.blockrun_action_provider import (
    USDC_ADDRESSES,
    BlockrunActionProvider,
)
from coinbase_agentkit.network import Network


def test_get_usdc_balance_success():
    """Test successful USDC balance check."""
    mock_provider = MagicMock()
    mock_provider.get_address.return_value = "0x1234567890123456789012345678901234567890"
    mock_provider.get_network.return_value = Network(
        name="base-mainnet",
        protocol_family="evm",
        chain_id="8453",
        network_id="base-mainnet",
    )

    # Mock contract reads: decimals (6) and balance (1000000 = 1 USDC)
    mock_provider.read_contract.side_effect = [6, 1000000]

    provider = BlockrunActionProvider()
    result = provider.get_usdc_balance(mock_provider, {})
    result_data = json.loads(result)

    assert result_data["success"] is True
    assert result_data["balance"] == 1.0
    assert result_data["formatted_balance"] == "1.000000 USDC"
    assert result_data["network"] == "base-mainnet"
    assert result_data["usdc_contract"] == USDC_ADDRESSES["base-mainnet"]


def test_get_usdc_balance_low_balance_warning():
    """Test low balance warning."""
    mock_provider = MagicMock()
    mock_provider.get_address.return_value = "0x1234567890123456789012345678901234567890"
    mock_provider.get_network.return_value = Network(
        name="base-mainnet",
        protocol_family="evm",
        chain_id="8453",
        network_id="base-mainnet",
    )

    # Mock contract reads: decimals (6) and balance (50000 = 0.05 USDC)
    mock_provider.read_contract.side_effect = [6, 50000]

    provider = BlockrunActionProvider()
    result = provider.get_usdc_balance(mock_provider, {})
    result_data = json.loads(result)

    assert result_data["success"] is True
    assert result_data["balance"] == 0.05
    assert result_data["warning"] == "Low USDC balance"
    assert "suggestion" in result_data


def test_get_usdc_balance_base_sepolia():
    """Test USDC balance check on Base Sepolia."""
    mock_provider = MagicMock()
    mock_provider.get_address.return_value = "0x1234567890123456789012345678901234567890"
    mock_provider.get_network.return_value = Network(
        name="base-sepolia",
        protocol_family="evm",
        chain_id="84532",
        network_id="base-sepolia",
    )

    # Mock contract reads: decimals (6) and balance (5000000 = 5 USDC)
    mock_provider.read_contract.side_effect = [6, 5000000]

    provider = BlockrunActionProvider()
    result = provider.get_usdc_balance(mock_provider, {})
    result_data = json.loads(result)

    assert result_data["success"] is True
    assert result_data["balance"] == 5.0
    assert result_data["network"] == "base-sepolia"
    assert result_data["usdc_contract"] == USDC_ADDRESSES["base-sepolia"]


def test_get_usdc_balance_unsupported_network():
    """Test USDC balance check on unsupported network."""
    mock_provider = MagicMock()
    mock_provider.get_address.return_value = "0x1234567890123456789012345678901234567890"
    mock_provider.get_network.return_value = Network(
        name="ethereum-mainnet",
        protocol_family="evm",
        chain_id="1",
        network_id="ethereum-mainnet",
    )

    provider = BlockrunActionProvider()
    result = provider.get_usdc_balance(mock_provider, {})
    result_data = json.loads(result)

    assert result_data["error"] is True
    assert "not configured" in result_data["message"]


def test_get_usdc_balance_contract_error():
    """Test USDC balance check with contract error."""
    mock_provider = MagicMock()
    mock_provider.get_address.return_value = "0x1234567890123456789012345678901234567890"
    mock_provider.get_network.return_value = Network(
        name="base-mainnet",
        protocol_family="evm",
        chain_id="8453",
        network_id="base-mainnet",
    )
    mock_provider.read_contract.side_effect = Exception("Contract call failed")

    provider = BlockrunActionProvider()
    result = provider.get_usdc_balance(mock_provider, {})
    result_data = json.loads(result)

    assert result_data["error"] is True
    assert "Failed to get USDC balance" in result_data["message"]


def test_chat_completion_insufficient_balance(mock_wallet_provider, mock_x402_session):
    """Test chat completion with insufficient USDC balance."""
    from coinbase_agentkit.action_providers.blockrun.blockrun_action_provider import (
        BlockrunActionProvider,
    )

    # Setup mock wallet provider with network and low balance
    mock_wallet_provider.get_network.return_value = Network(
        name="base-mainnet",
        protocol_family="evm",
        chain_id="8453",
        network_id="base-mainnet",
    )
    # Mock contract reads: decimals (6) and balance (5000 = 0.005 USDC - too low)
    mock_wallet_provider.read_contract.side_effect = [6, 5000]

    with patch(
        "coinbase_agentkit.action_providers.blockrun.blockrun_action_provider.x402_requests"
    ) as mock_x402_requests:
        mock_x402_requests.return_value = mock_x402_session

        provider = BlockrunActionProvider()
        args = {"prompt": "Hello"}

        result = provider.chat_completion(mock_wallet_provider, args)
        result_data = json.loads(result)

        assert result_data["error"] is True
        assert "Insufficient USDC balance" in result_data["message"]
        # The x402 session should NOT have been called
        mock_x402_session.post.assert_not_called()


def test_chat_completion_proceeds_with_sufficient_balance(
    mock_wallet_provider, mock_x402_session
):
    """Test chat completion proceeds when USDC balance is sufficient."""
    from coinbase_agentkit.action_providers.blockrun.blockrun_action_provider import (
        BlockrunActionProvider,
    )

    # Setup mock wallet provider with network and sufficient balance
    mock_wallet_provider.get_network.return_value = Network(
        name="base-mainnet",
        protocol_family="evm",
        chain_id="8453",
        network_id="base-mainnet",
    )
    # Mock contract reads: decimals (6) and balance (1000000 = 1 USDC)
    mock_wallet_provider.read_contract.side_effect = [6, 1000000]

    with patch(
        "coinbase_agentkit.action_providers.blockrun.blockrun_action_provider.x402_requests"
    ) as mock_x402_requests:
        mock_x402_requests.return_value = mock_x402_session

        provider = BlockrunActionProvider()
        args = {"prompt": "Hello"}

        result = provider.chat_completion(mock_wallet_provider, args)
        result_data = json.loads(result)

        assert result_data["success"] is True
        # The x402 session SHOULD have been called
        mock_x402_session.post.assert_called_once()


def test_usdc_addresses_defined():
    """Test that USDC addresses are defined for supported networks."""
    assert "base-mainnet" in USDC_ADDRESSES
    assert "base-sepolia" in USDC_ADDRESSES
    # Verify address format (0x + 40 hex chars)
    for _network, address in USDC_ADDRESSES.items():
        assert address.startswith("0x")
        assert len(address) == 42
