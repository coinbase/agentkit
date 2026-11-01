"""Tests for the Foundry action provider."""

import json
from unittest.mock import Mock, patch

from coinbase_agentkit.action_providers.foundry import foundry_action_provider
from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers.evm_wallet_provider import EvmWalletProvider

MOCK_OPENAPI = {
    "paths": {
        "/v1/contract-facts": {
            "post": {
                "description": "Facts about a contract on Base: proxy, owner, verified source.",
                "tags": ["contract", "onchain"],
                "x-payment-info": {"price": {"amount": "0.002"}},
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {"properties": {"input": {"description": "Contract address"}}}
                        }
                    }
                },
            }
        },
        "/v1/ocr": {
            "post": {
                "description": "Extract text from an image or PDF URL.",
                "tags": ["ocr", "document"],
                "x-payment-info": {"price": {"amount": "0.02"}},
            }
        },
        "/stats": {"get": {"description": "Free stats"}},
    }
}


def mock_catalog():
    """Patch the OpenAPI fetch."""
    response = Mock(status_code=200)
    response.json.return_value = MOCK_OPENAPI
    response.raise_for_status.return_value = None
    return patch("requests.get", return_value=response)


def test_list_tools_returns_paid_routes_only():
    """Listing returns each paid route with its price and input."""
    with mock_catalog():
        result = json.loads(foundry_action_provider().list_foundry_tools(Mock(), {}))
    assert result["success"] is True
    assert [t["id"] for t in result["tools"]] == ["contract-facts", "ocr"]
    assert result["tools"][0]["price_usdc"] == 0.002
    assert result["tools"][0]["input"] == "Contract address"


def test_list_tools_filters_by_keyword():
    """Keyword matches id, description or tag."""
    with mock_catalog():
        result = json.loads(
            foundry_action_provider().list_foundry_tools(Mock(), {"keyword": "document"})
        )
    assert [t["id"] for t in result["tools"]] == ["ocr"]


def test_call_unknown_tool():
    """Unknown tool ids are rejected before any payment."""
    with mock_catalog():
        result = json.loads(
            foundry_action_provider().call_foundry_tool(Mock(), {"tool": "nope", "input": "x"})
        )
    assert result["error"] is True
    assert result["message"] == "Unknown tool"


def test_call_rejects_price_above_limit():
    """Tools priced above the limit are not called."""
    with (
        mock_catalog(),
        patch(
            "coinbase_agentkit.action_providers.foundry.foundry_action_provider.x402_requests"
        ) as session,
    ):
        result = json.loads(
            foundry_action_provider(max_payment_usdc=0.01).call_foundry_tool(
                Mock(), {"tool": "ocr", "input": "https://example.com/a.png"}
            )
        )
    assert result["message"] == "Payment exceeds limit"
    session.assert_not_called()


def test_call_pays_and_returns_result():
    """A successful call posts the input with x402 and returns the result."""
    wallet = Mock(spec=EvmWalletProvider)
    paid = Mock(status_code=200, headers={"payment-response": "abc"})
    paid.json.return_value = {"proxy": False}
    module = "coinbase_agentkit.action_providers.foundry.foundry_action_provider"
    with (
        mock_catalog(),
        patch(f"{module}.x402_requests") as session,
        patch(f"{module}.EthAccountSigner"),
        patch(f"{module}.register_exact_evm_client"),
    ):
        session.return_value.post.return_value = paid
        result = json.loads(
            foundry_action_provider().call_foundry_tool(
                wallet, {"tool": "contract-facts", "input": "0xabc"}
            )
        )
    assert result["success"] is True
    assert result["result"] == {"proxy": False}
    url = session.return_value.post.call_args.args[0]
    assert url == "https://minty-sprout.onrender.com/v1/contract-facts"
    assert session.return_value.post.call_args.kwargs["json"] == {"input": "0xabc"}


def test_failed_call_reports_not_settled():
    """Non-200 responses are reported as unsettled."""
    failed = Mock(status_code=502)
    failed.json.return_value = {"error": "upstream"}
    module = "coinbase_agentkit.action_providers.foundry.foundry_action_provider"
    with (
        mock_catalog(),
        patch(f"{module}.x402_requests") as session,
        patch(f"{module}.EthAccountSigner"),
        patch(f"{module}.register_exact_evm_client"),
    ):
        session.return_value.post.return_value = failed
        result = json.loads(
            foundry_action_provider().call_foundry_tool(
                Mock(spec=EvmWalletProvider), {"tool": "contract-facts", "input": "0xabc"}
            )
        )
    assert result["error"] is True
    assert "not settled" in result["message"]


def test_supports_base_mainnet_only():
    """Only Base mainnet is supported."""
    provider = foundry_action_provider()
    assert provider.supports_network(
        Network(protocol_family="evm", network_id="base-mainnet", chain_id="8453")
    )
    assert not provider.supports_network(
        Network(protocol_family="evm", network_id="base-sepolia", chain_id="84532")
    )
