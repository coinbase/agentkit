"""Tests for Twitter action provider initialization."""

from unittest.mock import patch

import pytest

from coinbase_agentkit.action_providers.twitter.twitter_action_provider import (
    twitter_action_provider,
)


@pytest.mark.usefixtures("mock_env")
def test_provider_init_with_env_vars():
    """Test provider initialization with environment variables."""
    with patch("tweepy.Client") as mock_client:
        twitter_action_provider()
        mock_client.assert_called_once_with(
            consumer_key="mock_api_key",
            consumer_secret="mock_api_secret",
            access_token="mock_access_token",
            access_token_secret="mock_access_token_secret",
            bearer_token="mock_bearer_token",
            return_type=dict,
        )


def test_provider_init_with_args():
    """Test provider initialization with explicit arguments."""
    with patch("tweepy.Client") as mock_client:
        twitter_action_provider(
            api_key="test_key",
            api_secret="test_secret",
            access_token="test_token",
            access_token_secret="test_token_secret",
            bearer_token="test_bearer_token",
        )
        mock_client.assert_called_once_with(
            consumer_key="test_key",
            consumer_secret="test_secret",
            access_token="test_token",
            access_token_secret="test_token_secret",
            bearer_token="test_bearer_token",
            return_type=dict,
        )


def test_provider_init_missing_credentials():
    """Test provider initialization fails with missing credentials."""
    with pytest.raises(ValueError, match="TWITTER_API_KEY is not configured"):
        twitter_action_provider()


def test_provider_init_missing_bearer_token():
    """Test provider initialization fails with missing bearer token."""
    with (
        patch.dict(
            "os.environ",
            {
                "TWITTER_API_KEY": "test_key",
                "TWITTER_API_SECRET": "test_secret",
                "TWITTER_ACCESS_TOKEN": "test_token",
                "TWITTER_ACCESS_TOKEN_SECRET": "test_token_secret",
            },
        ),
        pytest.raises(ValueError, match="TWITTER_BEARER_TOKEN is not configured"),
    ):
        twitter_action_provider()
