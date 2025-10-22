"""Tests for Twitter post tweet reply action."""

from json import dumps
from unittest.mock import patch

import pytest
import tweepy

from coinbase_agentkit.action_providers.twitter.schemas import PostTweetReplySchema
from coinbase_agentkit.action_providers.twitter.twitter_action_provider import (
    twitter_action_provider,
)

MOCK_TWEET_ID = "1234"
MOCK_REPLY_TEXT = "Hello, this is a reply!"
MOCK_REPLY_ID = "5678"
MOCK_EDIT_HISTORY_IDS = ["5678"]


def test_post_tweet_reply_input_model_valid():
    """Test that PostTweetReplyInput accepts valid parameters."""
    input_model = PostTweetReplySchema(
        **{"tweet_id": MOCK_TWEET_ID, "tweet_reply": MOCK_REPLY_TEXT}
    )
    assert isinstance(input_model, PostTweetReplySchema)
    assert input_model.tweet_id == MOCK_TWEET_ID
    assert input_model.tweet_reply == MOCK_REPLY_TEXT


def test_post_tweet_reply_input_model_invalid():
    """Test that PostTweetReplyInput rejects invalid parameters."""
    with pytest.raises(ValueError):
        PostTweetReplySchema(**{})


@pytest.mark.usefixtures("mock_env")
def test_post_tweet_reply_success():
    """Test successful posting of a tweet reply."""
    provider = twitter_action_provider()

    mock_response = {
        "data": {
            "id": MOCK_REPLY_ID,
            "text": MOCK_REPLY_TEXT,
            "edit_history_tweet_ids": MOCK_EDIT_HISTORY_IDS,
        }
    }

    expected_response = f"Successfully posted reply to Twitter:\n{dumps(mock_response)}"

    with patch.object(
        provider.client, "create_tweet", return_value=mock_response
    ) as mock_create_tweet:
        response = provider.post_tweet_reply(
            {"tweet_id": MOCK_TWEET_ID, "tweet_reply": MOCK_REPLY_TEXT}
        )

        assert response == expected_response
        mock_create_tweet.assert_called_once_with(
            text=MOCK_REPLY_TEXT, in_reply_to_tweet_id=MOCK_TWEET_ID
        )


@pytest.mark.usefixtures("mock_env")
def test_post_tweet_reply_failure():
    """Test failure when an API error occurs."""
    provider = twitter_action_provider()
    error = tweepy.errors.TweepyException("Tweepy Error")
    expected_response = f"Error posting reply to Twitter:\n{error}"

    with patch.object(provider.client, "create_tweet", side_effect=error) as mock_create_tweet:
        response = provider.post_tweet_reply(
            {"tweet_id": MOCK_TWEET_ID, "tweet_reply": MOCK_REPLY_TEXT}
        )

        assert response == expected_response
        mock_create_tweet.assert_called_once_with(
            text=MOCK_REPLY_TEXT, in_reply_to_tweet_id=MOCK_TWEET_ID
        )
