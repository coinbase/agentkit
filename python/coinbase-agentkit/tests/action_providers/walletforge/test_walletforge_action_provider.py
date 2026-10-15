"""Tests for the WalletForge action provider."""

import json
from unittest.mock import Mock, patch

import pytest
from pydantic import ValidationError

from coinbase_agentkit.action_providers.walletforge.client import PaidResponse
from coinbase_agentkit.action_providers.walletforge.schemas import (
    FetchMarkdownSchema,
    NormalizeTextSchema,
)
from coinbase_agentkit.action_providers.walletforge.walletforge_action_provider import (
    walletforge_action_provider,
)
from coinbase_agentkit.network import Network

from .conftest import MOCK_PRIVATE_KEY


def test_fetch_markdown_schema_valid():
    """Test FetchMarkdownSchema accepts valid inputs."""
    schema = FetchMarkdownSchema(url="https://example.com")
    assert schema.url == "https://example.com"
    assert schema.max_chars is None

    schema = FetchMarkdownSchema(url="https://example.com", max_chars=5000)
    assert schema.max_chars == 5000


def test_fetch_markdown_schema_invalid():
    """Test FetchMarkdownSchema rejects invalid inputs."""
    with pytest.raises(ValidationError):
        FetchMarkdownSchema()
    with pytest.raises(ValidationError):
        FetchMarkdownSchema(url="https://example.com", max_chars=10)


def test_normalize_text_schema_valid():
    """Test NormalizeTextSchema accepts valid inputs."""
    schema = NormalizeTextSchema(text="hello")
    assert schema.text == "hello"


def test_normalize_text_schema_invalid():
    """Test NormalizeTextSchema rejects empty text."""
    with pytest.raises(ValidationError):
        NormalizeTextSchema()
    with pytest.raises(ValidationError):
        NormalizeTextSchema(text="")


def test_fetch_markdown_success(mock_wallet):
    """Test fetch_markdown returns JSON from a mocked buyer."""
    buyer = Mock()
    buyer.fetch_markdown.return_value = PaidResponse(
        status_code=200,
        data={"markdown": "# Hi", "url": "https://example.com"},
        headers={},
        payment_response={"transaction": "0xabc"},
    )
    provider = walletforge_action_provider(buyer=buyer)

    result = provider.fetch_markdown(mock_wallet, {"url": "https://example.com", "max_chars": 5000})
    parsed = json.loads(result)
    assert parsed["success"] is True
    assert parsed["data"]["markdown"] == "# Hi"
    assert parsed["payment_response"]["transaction"] == "0xabc"
    buyer.fetch_markdown.assert_called_once_with("https://example.com", max_chars=5000)


def test_normalize_text_success(mock_wallet):
    """Test normalize_text returns JSON from a mocked buyer."""
    buyer = Mock()
    buyer.normalize.return_value = PaidResponse(
        status_code=200,
        data={"normalized": "hello", "emails": [], "urls": [], "phones": []},
        headers={},
    )
    provider = walletforge_action_provider(buyer=buyer)

    result = provider.normalize_text(mock_wallet, {"text": "hello"})
    parsed = json.loads(result)
    assert parsed["success"] is True
    assert parsed["data"]["normalized"] == "hello"
    buyer.normalize.assert_called_once_with("hello")


def test_fetch_markdown_error(mock_wallet):
    """Test fetch_markdown surfaces buyer errors as JSON."""
    buyer = Mock()
    buyer.fetch_markdown.side_effect = RuntimeError("boom")
    provider = walletforge_action_provider(buyer=buyer)

    result = provider.fetch_markdown(mock_wallet, {"url": "https://example.com"})
    parsed = json.loads(result)
    assert parsed["success"] is False
    assert "boom" in parsed["error"]


def test_resolve_buyer_from_private_key(mock_wallet):
    """Test provider builds an in-tree client from a private key."""
    with patch(
        "coinbase_agentkit.action_providers.walletforge.walletforge_action_provider.WalletForgeClient"
    ) as mock_client_cls:
        mock_client = Mock()
        mock_client.fetch_markdown.return_value = PaidResponse(
            status_code=200, data={"markdown": "x"}, headers={}
        )
        mock_client_cls.from_private_key.return_value = mock_client
        provider = walletforge_action_provider(private_key=MOCK_PRIVATE_KEY)
        result = provider.fetch_markdown(mock_wallet, {"url": "https://example.com"})

    parsed = json.loads(result)
    assert parsed["success"] is True
    mock_client_cls.from_private_key.assert_called_once()


def test_supports_network():
    """Test WalletForge is offered on Base mainnet EVM only."""
    provider = walletforge_action_provider(buyer=Mock())
    assert (
        provider.supports_network(
            Network(protocol_family="evm", network_id="base-mainnet", chain_id="8453")
        )
        is True
    )
    assert provider.supports_network(Network(protocol_family="evm", chain_id="8453")) is True
    assert (
        provider.supports_network(
            Network(protocol_family="evm", network_id="base-sepolia", chain_id="84532")
        )
        is False
    )
    assert (
        provider.supports_network(Network(protocol_family="solana", network_id="solana-mainnet"))
        is False
    )


def test_factory_name():
    """Test factory returns a provider named walletforge."""
    provider = walletforge_action_provider(buyer=Mock())
    assert provider.name == "walletforge"
