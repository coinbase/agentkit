"""Tests for Twitter post tweet action."""

from json import dumps
from unittest.mock import patch

import pytest
import tweepy

from coinbase_agentkit.action_providers.twitter.schemas import PostTweetSchema
from coinbase_agentkit.action_providers.twitter.twitter_action_provider import (
    twitter_action_provider,
)

MOCK_TWEET_TEXT = "Hello, world!"
MOCK_TWEET_ID = "1234"
MOCK_EDIT_HISTORY_IDS = ["1234"]


def test_post_tweet_input_model_valid():
    """Test that PostTweetInput accepts valid parameters."""
    input_model = PostTweetSchema(**{"tweet": MOCK_TWEET_TEXT})
    assert isinstance(input_model, PostTweetSchema)
    assert input_model.tweet == MOCK_TWEET_TEXT


def test_post_tweet_input_model_invalid():
    """Test that PostTweetInput rejects invalid parameters."""
    with pytest.raises(ValueError):
        PostTweetSchema(**{})


@pytest.mark.usefixtures("mock_env")
def test_post_tweet_success():
    """Test successful posting of a tweet."""
    provider = twitter_action_provider()

    mock_response = {
        "data": {
            "id": MOCK_TWEET_ID,
            "text": MOCK_TWEET_TEXT,
            "edit_history_tweet_ids": MOCK_EDIT_HISTORY_IDS,
        }
    }

    expected_response = f"Successfully posted to Twitter:\n{dumps(mock_response)}"

    with patch.object(
        provider.client, "create_tweet", return_value=mock_response
    ) as mock_create_tweet:
        response = provider.post_tweet({"tweet": MOCK_TWEET_TEXT})

        assert response == expected_response
        mock_create_tweet.assert_called_once_with(text=MOCK_TWEET_TEXT)


@pytest.mark.usefixtures("mock_env")
def test_post_tweet_failure():
    """Test failure when an API error occurs."""
    provider = twitter_action_provider()
    error = tweepy.errors.TweepyException("Tweepy Error")
    expected_response = f"Error posting to Twitter:\n{error}"

    with patch.object(provider.client, "create_tweet", side_effect=error) as mock_create_tweet:
        response = provider.post_tweet({"tweet": MOCK_TWEET_TEXT})

        assert response == expected_response
        mock_create_tweet.assert_called_once_with(text=MOCK_TWEET_TEXT)
