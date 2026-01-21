"""End-to-end tests for BlockRun chat_completion action.

These tests make real API calls and require:
- CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET environment variables
- Wallet with USDC balance on Base mainnet

Run with: pytest -m e2e tests/action_providers/blockrun/e2e/
"""

import json

import pytest


@pytest.mark.e2e
def test_chat_completion_real_api(e2e_provider, cdp_wallet_provider):
    """Test real chat completion API call."""
    args = {
        "prompt": "What is 2 + 2? Reply with just the number.",
        "model": "openai/gpt-4o-mini",
        "max_tokens": 10,
        "temperature": 0.0,
    }

    result = e2e_provider.chat_completion(cdp_wallet_provider, args)
    result_data = json.loads(result)

    print(f"E2E Result: {json.dumps(result_data, indent=2)}")

    assert result_data["success"] is True
    assert "response" in result_data
    assert "4" in result_data["response"]
    assert result_data["payment"] == "Paid via x402 micropayment on Base"


@pytest.mark.e2e
def test_chat_completion_claude(e2e_provider, cdp_wallet_provider):
    """Test real chat completion with Claude."""
    args = {
        "prompt": "Say 'Hello BlockRun' and nothing else.",
        "model": "anthropic/claude-sonnet-4",
        "max_tokens": 20,
        "temperature": 0.0,
    }

    result = e2e_provider.chat_completion(cdp_wallet_provider, args)
    result_data = json.loads(result)

    print(f"Claude E2E Result: {json.dumps(result_data, indent=2)}")

    assert result_data["success"] is True
    assert "response" in result_data
    assert "BlockRun" in result_data["response"] or "Hello" in result_data["response"]


@pytest.mark.e2e
def test_chat_completion_with_system_prompt(e2e_provider, cdp_wallet_provider):
    """Test real chat completion with system prompt."""
    args = {
        "prompt": "What are you?",
        "model": "openai/gpt-4o-mini",
        "system_prompt": "You are a helpful pirate. Always talk like a pirate.",
        "max_tokens": 50,
        "temperature": 0.7,
    }

    result = e2e_provider.chat_completion(cdp_wallet_provider, args)
    result_data = json.loads(result)

    print(f"System Prompt E2E Result: {json.dumps(result_data, indent=2)}")

    assert result_data["success"] is True
    assert "response" in result_data
