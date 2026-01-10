"""Tests for BlockRun list_models action."""

import json

import pytest

from coinbase_agentkit.action_providers.blockrun.blockrun_action_provider import (
    AVAILABLE_MODELS,
    BlockrunActionProvider,
)


def test_list_models(mock_wallet_key):
    """Test list_models action."""
    provider = BlockrunActionProvider(wallet_key=mock_wallet_key)

    result = provider.list_models({})
    result_data = json.loads(result)

    assert result_data["success"] is True
    assert "models" in result_data
    assert "payment_info" in result_data


def test_list_models_contains_all_models(mock_wallet_key):
    """Test that list_models contains all available models."""
    provider = BlockrunActionProvider(wallet_key=mock_wallet_key)

    result = provider.list_models({})
    result_data = json.loads(result)

    models = result_data["models"]

    # Check all expected models are present
    assert "openai/gpt-4o" in models
    assert "openai/gpt-4o-mini" in models
    assert "anthropic/claude-sonnet-4" in models
    assert "google/gemini-2.0-flash" in models
    assert "deepseek/deepseek-chat" in models


def test_list_models_model_structure(mock_wallet_key):
    """Test that models have correct structure."""
    provider = BlockrunActionProvider(wallet_key=mock_wallet_key)

    result = provider.list_models({})
    result_data = json.loads(result)

    models = result_data["models"]

    for model_id, model_info in models.items():
        assert "name" in model_info
        assert "provider" in model_info
        assert "description" in model_info


def test_list_models_payment_info(mock_wallet_key):
    """Test that payment_info is correct."""
    provider = BlockrunActionProvider(wallet_key=mock_wallet_key)

    result = provider.list_models({})
    result_data = json.loads(result)

    payment_info = result_data["payment_info"]

    assert payment_info["network"] == "Base (Mainnet or Sepolia)"
    assert payment_info["currency"] == "USDC"
    assert payment_info["method"] == "x402 micropayments"


def test_list_models_matches_constant(mock_wallet_key):
    """Test that list_models returns same models as AVAILABLE_MODELS constant."""
    provider = BlockrunActionProvider(wallet_key=mock_wallet_key)

    result = provider.list_models({})
    result_data = json.loads(result)

    assert result_data["models"] == AVAILABLE_MODELS
