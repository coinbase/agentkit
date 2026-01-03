"""Tests for WETH action provider."""

from unittest.mock import patch

import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.weth.schemas import UnwrapEthSchema, WrapEthSchema
from coinbase_agentkit.action_providers.weth.weth_action_provider import (
    WETH_ABI,
    WethActionProvider,
    get_weth_address,
)
from coinbase_agentkit.network import Network

from .conftest import MOCK_TX_HASH

MOCK_AMOUNT = "0.1"


def test_wrap_eth_input_model_valid():
    """Test that WrapEthSchema accepts valid parameters."""
    input_model = WrapEthSchema(amount_to_wrap=MOCK_AMOUNT)

    assert isinstance(input_model, WrapEthSchema)
    assert input_model.amount_to_wrap == MOCK_AMOUNT


def test_wrap_eth_input_model_invalid_format():
    """Test that WrapEthSchema rejects invalid format inputs."""
    invalid_inputs = [
        "",
        "abc",
        "invalid",
    ]
    for invalid_input in invalid_inputs:
        with pytest.raises(ValidationError) as exc_info:
            WrapEthSchema(amount_to_wrap=invalid_input)
        assert "Amount must be a valid number" in str(exc_info.value)

    # Test negative amount separately
    with pytest.raises(ValidationError) as exc_info:
        WrapEthSchema(amount_to_wrap="-0.1")
    assert "Amount must be greater than 0" in str(exc_info.value)


def test_wrap_eth_input_model_negative_amount():
    """Test that WrapEthSchema rejects negative amounts."""
    with pytest.raises(ValidationError) as exc_info:
        WrapEthSchema(amount_to_wrap="-0.1")
    assert "Amount must be greater than 0" in str(exc_info.value)


def test_wrap_eth_input_model_missing_params():
    """Test that WrapEthSchema raises error when params are missing."""
    with pytest.raises(ValidationError):
        WrapEthSchema()


def test_wrap_eth_success(mock_wallet_provider):
    """Test successful ETH wrapping."""
    with (
        patch("coinbase_agentkit.action_providers.weth.weth_action_provider.Web3") as mock_web3,
        patch("coinbase_agentkit.action_providers.weth.weth_action_provider.to_wei") as mock_to_wei,
    ):
        mock_contract = mock_web3.return_value.eth.contract.return_value
        mock_contract.encode_abi.return_value = "0xencoded"
        mock_to_wei.return_value = 100000000000000000  # 0.1 ETH in wei

        # Mock the ETH balance check to return sufficient balance
        mock_wallet_provider.get_balance.return_value = 200000000000000000  # 0.2 ETH in wei

        provider = WethActionProvider()
        args = {"amount_to_wrap": MOCK_AMOUNT}
        response = provider.wrap_eth(mock_wallet_provider, args)

        expected_response = f"Wrapped {MOCK_AMOUNT} ETH to WETH. Transaction hash: {MOCK_TX_HASH}"
        assert response == expected_response

        # Verify to_wei was called with decimal amount
        mock_to_wei.assert_called_once_with(MOCK_AMOUNT, "ether")

        # Verify get_balance was called to check ETH balance
        mock_wallet_provider.get_balance.assert_called_once()

        mock_web3.return_value.eth.contract.assert_called_once()
        call_args = mock_web3.return_value.eth.contract.call_args
        assert call_args[1]["abi"] == WETH_ABI

        mock_contract.encode_abi.assert_called_once_with(
            "deposit",
            args=[],
        )

        mock_wallet_provider.send_transaction.assert_called_once()
        tx = mock_wallet_provider.send_transaction.call_args[0][0]
        assert tx["data"] == "0xencoded"
        assert tx["value"] == str(100000000000000000)  # wei value

        mock_wallet_provider.wait_for_transaction_receipt.assert_called_once_with(MOCK_TX_HASH)


def test_wrap_eth_insufficient_balance(mock_wallet_provider):
    """Test wrap_eth with insufficient ETH balance."""
    with (
        patch("coinbase_agentkit.action_providers.weth.weth_action_provider.to_wei") as mock_to_wei,
    ):
        mock_to_wei.return_value = 100000000000000000  # 0.1 ETH in wei

        # Mock the ETH balance check to return insufficient balance
        mock_wallet_provider.get_balance.return_value = 50000000000000000  # 0.05 ETH in wei

        provider = WethActionProvider()
        args = {"amount_to_wrap": MOCK_AMOUNT}
        response = provider.wrap_eth(mock_wallet_provider, args)

        assert "Error: Insufficient ETH balance" in response
        assert "0.05" in response  # Check formatted balance appears

        # Verify get_balance was called to check ETH balance
        mock_wallet_provider.get_balance.assert_called_once()

        # Should not have attempted to send transaction
        mock_wallet_provider.send_transaction.assert_not_called()


def test_wrap_eth_validation_error(mock_wallet_provider):
    """Test wrap_eth with invalid input."""
    provider = WethActionProvider()

    invalid_inputs = [
        {},
        {"amount_to_wrap": ""},
        {"amount_to_wrap": "-0.1"},
        {"amount_to_wrap": "abc"},
        {"amount_to_wrap": "invalid"},
    ]

    for invalid_input in invalid_inputs:
        response = provider.wrap_eth(mock_wallet_provider, invalid_input)
        assert "Error wrapping ETH: " in response
        assert "validation error" in response.lower()


def test_wrap_eth_transaction_error(mock_wallet_provider):
    """Test wrap_eth when transaction fails."""
    with (
        patch("coinbase_agentkit.action_providers.weth.weth_action_provider.Web3") as mock_web3,
        patch("coinbase_agentkit.action_providers.weth.weth_action_provider.to_wei") as mock_to_wei,
    ):
        mock_contract = mock_web3.return_value.eth.contract.return_value
        mock_contract.encode_abi.return_value = "0xencoded"
        mock_to_wei.return_value = 100000000000000000  # 0.1 ETH in wei

        # Mock the ETH balance check to return sufficient balance
        mock_wallet_provider.get_balance.return_value = 200000000000000000  # 0.2 ETH in wei

        mock_wallet_provider.send_transaction.side_effect = Exception("Transaction failed")

        provider = WethActionProvider()
        args = {"amount_to_wrap": MOCK_AMOUNT}
        response = provider.wrap_eth(mock_wallet_provider, args)

        expected_response = "Error wrapping ETH: Transaction failed"
        assert response == expected_response

        mock_web3.return_value.eth.contract.assert_called_once()
        call_args = mock_web3.return_value.eth.contract.call_args
        assert call_args[1]["abi"] == WETH_ABI


def test_supports_network():
    """Test network support validation."""
    provider = WethActionProvider()

    test_cases = [
        ("base-mainnet", "8453", "evm", True),
        ("base-sepolia", "84532", "evm", True),
        ("ethereum-mainnet", "1", "evm", True),
        ("arbitrum-mainnet", "42161", "evm", True),
        ("optimism-mainnet", "10", "evm", True),
        ("polygon-mainnet", "137", "evm", False),  # No WETH for Polygon in our constants
        ("base-goerli", "84531", "evm", False),
        ("mainnet", None, "bitcoin", False),
        ("mainnet", None, "solana", False),
    ]

    for network_id, chain_id, protocol_family, expected_result in test_cases:
        network = Network(protocol_family=protocol_family, chain_id=chain_id, network_id=network_id)
        result = provider.supports_network(network)
        assert (
            result is expected_result
        ), f"Network {network_id} (chain_id: {chain_id}) should{' ' if expected_result else ' not '}be supported"


def test_get_weth_address():
    """Test get_weth_address function."""
    # Test supported networks
    base_mainnet = Network(protocol_family="evm", network_id="base-mainnet", chain_id="8453")
    assert get_weth_address(base_mainnet) == "0x4200000000000000000000000000000000000006"

    ethereum_mainnet = Network(protocol_family="evm", network_id="ethereum-mainnet", chain_id="1")
    assert get_weth_address(ethereum_mainnet) == "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"

    arbitrum_mainnet = Network(
        protocol_family="evm", network_id="arbitrum-mainnet", chain_id="42161"
    )
    assert get_weth_address(arbitrum_mainnet) == "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"

    optimism_mainnet = Network(protocol_family="evm", network_id="optimism-mainnet", chain_id="10")
    assert get_weth_address(optimism_mainnet) == "0x4200000000000000000000000000000000000006"

    # Test unsupported network
    polygon_mainnet = Network(protocol_family="evm", network_id="polygon-mainnet", chain_id="137")
    assert get_weth_address(polygon_mainnet) is None


def test_unwrap_eth_input_model_valid():
    """Test that UnwrapEthSchema accepts valid parameters."""
    input_model = UnwrapEthSchema(amount_to_unwrap=MOCK_AMOUNT)

    assert isinstance(input_model, UnwrapEthSchema)
    assert input_model.amount_to_unwrap == MOCK_AMOUNT


def test_unwrap_eth_input_model_invalid_format():
    """Test that UnwrapEthSchema rejects invalid format inputs."""
    invalid_inputs = [
        "",
        "abc",
        "invalid",
    ]
    for invalid_input in invalid_inputs:
        with pytest.raises(ValidationError) as exc_info:
            UnwrapEthSchema(amount_to_unwrap=invalid_input)
        assert "Amount must be a valid number" in str(exc_info.value)

    # Test negative amount separately
    with pytest.raises(ValidationError) as exc_info:
        UnwrapEthSchema(amount_to_unwrap="-0.1")
    assert "Amount must be greater than 0" in str(exc_info.value)


def test_unwrap_eth_success(mock_wallet_provider):
    """Test successful WETH unwrapping."""
    with (
        patch("coinbase_agentkit.action_providers.weth.weth_action_provider.Web3") as mock_web3,
        patch("coinbase_agentkit.action_providers.weth.weth_action_provider.to_wei") as mock_to_wei,
    ):
        mock_contract = mock_web3.return_value.eth.contract.return_value
        mock_contract.encode_abi.return_value = "0xencoded"
        mock_to_wei.return_value = 100000000000000000  # 0.1 ETH in wei

        # Mock the WETH balance check to return sufficient balance
        mock_wallet_provider.read_contract.return_value = 200000000000000000  # 0.2 WETH in wei

        provider = WethActionProvider()
        args = {"amount_to_unwrap": MOCK_AMOUNT}
        response = provider.unwrap_eth(mock_wallet_provider, args)

        expected_response = f"Unwrapped {MOCK_AMOUNT} WETH to ETH. Transaction hash: {MOCK_TX_HASH}"
        assert response == expected_response

        # Verify to_wei was called with decimal amount
        mock_to_wei.assert_called_once_with(MOCK_AMOUNT, "ether")

        # Verify read_contract was called to check WETH balance
        mock_wallet_provider.read_contract.assert_called_once()

        mock_web3.return_value.eth.contract.assert_called_once()
        call_args = mock_web3.return_value.eth.contract.call_args
        assert call_args[1]["abi"] == WETH_ABI

        mock_contract.encode_abi.assert_called_once_with(
            "withdraw",
            args=[100000000000000000],  # wei value
        )

        mock_wallet_provider.send_transaction.assert_called_once()
        tx = mock_wallet_provider.send_transaction.call_args[0][0]
        assert tx["data"] == "0xencoded"

        mock_wallet_provider.wait_for_transaction_receipt.assert_called_once_with(MOCK_TX_HASH)


def test_unwrap_eth_insufficient_balance(mock_wallet_provider):
    """Test unwrap_eth with insufficient WETH balance."""
    with (
        patch("coinbase_agentkit.action_providers.weth.weth_action_provider.to_wei") as mock_to_wei,
    ):
        mock_to_wei.return_value = 100000000000000000  # 0.1 ETH in wei

        # Mock the WETH balance check to return insufficient balance
        mock_wallet_provider.read_contract.return_value = 50000000000000000  # 0.05 WETH in wei

        provider = WethActionProvider()
        args = {"amount_to_unwrap": MOCK_AMOUNT}
        response = provider.unwrap_eth(mock_wallet_provider, args)

        assert "Error: Insufficient WETH balance" in response
        assert "0.05" in response  # Check formatted balance appears

        # Verify read_contract was called to check WETH balance
        mock_wallet_provider.read_contract.assert_called_once()

        # Should not have attempted to send transaction
        mock_wallet_provider.send_transaction.assert_not_called()


def test_unwrap_eth_validation_error(mock_wallet_provider):
    """Test unwrap_eth with invalid input."""
    provider = WethActionProvider()

    invalid_inputs = [
        {},
        {"amount_to_unwrap": ""},
        {"amount_to_unwrap": "-0.1"},
        {"amount_to_unwrap": "abc"},
    ]

    for invalid_input in invalid_inputs:
        response = provider.unwrap_eth(mock_wallet_provider, invalid_input)
        assert "Error unwrapping WETH: " in response
        assert "validation error" in response.lower()


def test_unwrap_eth_unsupported_network(mock_wallet_provider):
    """Test unwrap_eth with unsupported network."""
    # Mock a network that doesn't have WETH
    mock_wallet_provider.get_network.return_value = Network(
        protocol_family="evm", network_id="polygon-mainnet", chain_id="137"
    )

    provider = WethActionProvider()
    args = {"amount_to_unwrap": MOCK_AMOUNT}
    response = provider.unwrap_eth(mock_wallet_provider, args)

    assert "Error: WETH not supported on network polygon-mainnet" in response


def test_action_provider_setup():
    """Test action provider initialization."""
    provider = WethActionProvider()
    assert provider.name == "weth"
    assert provider.action_providers == []
