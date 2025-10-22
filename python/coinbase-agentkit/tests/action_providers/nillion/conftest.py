"""Shared fixtures for Nillion action provider tests."""

import json
from unittest.mock import MagicMock, patch

import pytest

TEST_SCHEMA_ID = "1f105829-2698-47e5-8f35-c1665895f501"
TEST_SCHEMA_DEF = """{
  "name": "My names",
  "keys": ["_id"],
  "schema": {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "_id": {
          "type": "string",
          "format": "uuid",
          "coerce": true
        },
        "name": {
          "type": "string"
        }
      },
      "required": ["_id", "name"],
      "additionalProperties": false
    }
  }
}"""


class DummyChatOpenAIContent:
    """Placeholder class to mock LLM."""

    def __init__(self, content):
        """Provide content."""
        self.content = content


class DummyChatOpenAI:
    """Placeholder class to mock LLM."""

    def invoke(self, *args, **kwargs):
        """Provide output."""
        return "dummy"


class DummyChatOpenAISchema:
    """Placeholder class to mock LLM."""

    def invoke(self, *args, **kwargs):
        """Provide output."""
        return DummyChatOpenAIContent(TEST_SCHEMA_DEF)


class DummyChatOpenAILookup:
    """Placeholder class to mock LLM."""

    def invoke(self, *args, **kwargs):
        """Provide output."""
        return DummyChatOpenAIContent(TEST_SCHEMA_ID)


@pytest.fixture
def mock_env(monkeypatch):
    """Set up mock environment variables for SecretVault credentials."""
    monkeypatch.setenv("NILLION_SECRET_KEY", "DEADBEEF" * 8)
    monkeypatch.setenv(
        "NILLION_ORG_ID",
        "did:nil:testnet:nillion111111111111111111111111111111111111111",
    )


@pytest.fixture(autouse=False)
def mock_api_calls():
    """Mock SecretVault api calls configuration."""

    def _get(*args, **kwargs):
        url = kwargs.get("url") or args[0]

        if "/api/v1/schemas" in url:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "data": [{"_id": TEST_SCHEMA_ID, **json.loads(TEST_SCHEMA_DEF)}]
            }
            return mock_response
        else:
            # Default response for unspecified URLs
            mock_response = MagicMock()
            mock_response.status_code = 404
            return mock_response

    def _post(*args, **kwargs):
        url = kwargs.get("url") or args[0]

        if "/api/v1/schemas" in url:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"status": "mock"}
            return mock_response
        elif "api/v1/data/read" in url:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"debug": "read", "data": []}
            return mock_response
        elif "api/v1/data/create" in url:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"debug": "create", "data": []}
            return mock_response
        elif "api/config" in url:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "nodes": [
                    {
                        "name": "nildb-a50d",
                        "url": "https://nildb-a50d.nillion.network",
                        "did": "did:nil:testnet:nillion15lcjxgafgvs40rypvqu73gfvx6pkx7ugdja50d",
                        "publicKey": "02c2540363772b8ef12f8ea77ddaf71737aa0f46ed4fcf6fe6637a25dad9674c3d",
                    },
                    {
                        "name": "nildb-dvml",
                        "url": "https://nildb-dvml.nillion.network",
                        "did": "did:nil:testnet:nillion1dfh44cs4h2zek5vhzxkfvd9w28s5q5cdepdvml",
                        "publicKey": "0214613f89c4639a6c923509e323fca574629675cab95f39192ed85c18fda6c68f",
                    },
                    {
                        "name": "nildb-guue",
                        "url": "https://nildb-guue.nillion.network",
                        "did": "did:nil:testnet:nillion19t0gefm7pr6xjkq2sj40f0rs7wznldgfg4guue",
                        "publicKey": "03eab5c31424b1f95acfabdd8f6cb0a6b042c7dd9de6fb476a64c11a33a3805aea",
                    },
                ]
            }
            return mock_response
        else:
            # Default response for unspecified URLs
            mock_response = MagicMock()
            mock_response.status_code = 404
            return mock_response

    with patch("requests.post") as mock_post, patch("requests.get") as mock_get:
        mock_post.side_effect = _post
        mock_get.side_effect = _get
        yield mock_post, mock_get


@pytest.fixture(autouse=False)
def mock_chat_openai_basic():
    """Mock LLM object."""
    with patch("tests.action_providers.nillion.conftest.DummyChatOpenAI", autospec=True) as mock:
        yield mock
