"""Tests for the EvmWalletProvider abstract class."""

import pytest
import inspect

from coinbase_agentkit.wallet_providers.evm_wallet_provider import EvmGasConfig, EvmWalletProvider
from coinbase_agentkit.wallet_providers.wallet_provider import WalletProvider


def test_evm_wallet_provider_is_abstract():
    """Test that EvmWalletProvider cannot be instantiated directly."""
    with pytest.raises(TypeError, match="abstract methods"):
        EvmWalletProvider()


def test_inherits_from_wallet_provider():
    """Test that EvmWalletProvider inherits from WalletProvider."""
    assert issubclass(EvmWalletProvider, WalletProvider)


def test_required_methods():
    """Test that EvmWalletProvider defines the required additional abstract methods."""
    assert hasattr(EvmWalletProvider, "sign_message")
    assert hasattr(EvmWalletProvider, "sign_typed_data")
    assert hasattr(EvmWalletProvider, "sign_transaction")
    assert hasattr(EvmWalletProvider, "send_transaction")
    assert hasattr(EvmWalletProvider, "wait_for_transaction_receipt")
    assert hasattr(EvmWalletProvider, "read_contract")

    assert hasattr(EvmWalletProvider, "get_address")
    assert hasattr(EvmWalletProvider, "get_network")
    assert hasattr(EvmWalletProvider, "get_balance")
    assert hasattr(EvmWalletProvider, "get_name")
    assert hasattr(EvmWalletProvider, "native_transfer")


def test_evm_gas_config_defaults():
    """Test that EvmGasConfig has correct default values."""
    config = EvmGasConfig()
    assert config.gas_limit_multiplier is None
    assert config.fee_per_gas_multiplier is None


def test_evm_gas_config_custom_values():
    """Test that EvmGasConfig accepts custom values."""
    config = EvmGasConfig(gas_limit_multiplier=1.5, fee_per_gas_multiplier=1.2)
    assert config.gas_limit_multiplier == 1.5
    assert config.fee_per_gas_multiplier == 1.2


def test_method_signatures():
    """Test that EvmWalletProvider methods have consistent signatures."""
    # Expected method signatures
    expected_signatures = {
        "sign_message": ["message"],
        "sign_typed_data": ["typed_data"],
        "sign_transaction": ["transaction"],
        "send_transaction": ["transaction"],
        "wait_for_transaction_receipt": ["tx_hash", "timeout", "poll_latency"],
        "read_contract": ["contract_address", "abi", "function_name", "args", "block_identifier"],
        "get_address": [],
        "get_network": [],
        "get_balance": [],
        "get_name": [],
        "native_transfer": ["to", "value"],
    }
    
    # Verify each method signature
    for method_name, expected_params in expected_signatures.items():
        # Get the method from the class
        method = getattr(EvmWalletProvider, method_name)
        
        # Get the signature
        signature = inspect.signature(method)
        
        # Extract parameter names (exclude 'self')
        actual_params = [
            param for param in signature.parameters 
            if param != "self"
        ]
        
        # Verify that the required parameters are present
        for param in expected_params:
            assert param in actual_params, f"Method {method_name} is missing required parameter {param}"
            
        # For methods with default values, check they're properly optional
        for param_name, param in signature.parameters.items():
            if param_name != "self" and param_name not in expected_params:
                assert param.default != inspect.Parameter.empty, f"Non-required parameter {param_name} in {method_name} should have a default value"
