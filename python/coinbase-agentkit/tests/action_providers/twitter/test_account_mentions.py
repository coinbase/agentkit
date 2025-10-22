"""Tests for Twitter account mentions action."""

from json import dumps
from unittest.mock import patch

import pytest
import tweepy

from coinbase_agentkit.action_providers.twitter.schemas import AccountMentionsSchema
from coinbase_agentkit.action_providers.twitter.twitter_action_provider import (
    twitter_action_provider,
)

MOCK_USER_ID = "1234"
MOCK_TWEET_ID = "5678"
MOCK_TWEET_TEXT = "@testaccount Hello!"


def test_account_mentions_input_model_valid():
    """Test that AccountMentionsInput accepts valid parameters."""
    input_model = AccountMentionsSchema(**{"user_id": MOCK_USER_ID})
    assert isinstance(input_model, AccountMentionsSchema)
    assert input_model.user_id == MOCK_USER_ID


def test_account_mentions_input_model_invalid():
    """Test that AccountMentionsInput rejects invalid parameters."""
    with pytest.raises(ValueError):
        AccountMentionsSchema(**{})


@pytest.mark.usefixtures("mock_env")
def test_account_mentions_success():
    """Test successful retrieval of Twitter (X) account mentions."""
    provider = twitter_action_provider()

    mock_response = {"data": [{"id": MOCK_TWEET_ID, "text": MOCK_TWEET_TEXT}]}

    expected_response = f"Successfully retrieved account mentions:\n{dumps(mock_response)}"

    with patch.object(
        provider.client, "get_users_mentions", return_value=mock_response
    ) as mock_get_mentions:
        response = provider.account_mentions({"user_id": MOCK_USER_ID})

        assert response == expected_response
        mock_get_mentions.assert_called_once_with(MOCK_USER_ID)


@pytest.mark.usefixtures("mock_env")
def test_account_mentions_failure():
    """Test failure when an API error occurs."""
    provider = twitter_action_provider()
    error = tweepy.errors.TweepyException("Tweepy Error")
    expected_response = f"Error retrieving authenticated account mentions:\n{error}"

    with patch.object(
        provider.client, "get_users_mentions", side_effect=error
    ) as mock_get_mentions:
        response = provider.account_mentions({"user_id": MOCK_USER_ID})

        assert response == expected_response
        mock_get_mentions.assert_called_once_with(MOCK_USER_ID)
