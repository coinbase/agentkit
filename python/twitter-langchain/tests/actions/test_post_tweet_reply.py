from json import dumps
from unittest.mock import patch

import pytest
import tweepy
from cdp_agentkit_core.actions.social.twitter.post_tweet_reply import (
    PostTweetReplyInput,
    post_tweet_reply,
)

MOCK_TWEET_ID = "1234"
MOCK_TWEET_REPLY = "So good to be here!"


def test_post_tweet_input_model_valid():
    """Test that PostTweetReplyInput accepts valid parameters."""
    input_model = PostTweetReplyInput(
        tweet_id=MOCK_TWEET_ID,
        tweet_reply=MOCK_TWEET_REPLY,
    )

    assert input_model.tweet_id == MOCK_TWEET_ID
    assert input_model.tweet_reply == MOCK_TWEET_REPLY


def test_post_tweet_input_model_missing_params():
    """Test that PostTweetReplyInput raises error when params are missing."""
    with pytest.raises(ValueError):
        PostTweetReplyInput()


def test_post_tweet_success(tweepy_factory):
    """Test successful reply to a Twitter (X) post."""
    mock_client = tweepy_factory()
    mock_client_result = {
        "data": {
            "id": "0123456789012345678",
            "text": "So good to be here!",
            "edit_history_tweet_ids": ["1234567890123456789"],
        }
    }

    expected_response = f"Successfully posted reply to Twitter:\n{dumps(mock_client_result)}"

    with patch.object(mock_client, "create_tweet", return_value=mock_client_result) as mock_tweepy_create_tweet:
        response = post_tweet_reply(mock_client, MOCK_TWEET_ID, MOCK_TWEET_REPLY)

        assert response == expected_response
        mock_tweepy_create_tweet.assert_called_once_with(
            in_reply_to_tweet_id=MOCK_TWEET_ID,
            text=MOCK_TWEET_REPLY,
        )


def test_post_tweet_failure(tweepy_factory):
    """Test failure when an API error occurs."""
    mock_client = tweepy_factory()

    expected_result = tweepy.errors.TweepyException("Tweepy Error")
    expected_response = f"Error posting reply to Twitter:\n{expected_result}"

    with patch.object(mock_client, "create_tweet", side_effect=expected_result) as mock_tweepy_create_tweet:
        response = post_tweet_reply(mock_client, MOCK_TWEET_ID, MOCK_TWEET_REPLY)
        assert response == expected_response
        mock_tweepy_create_tweet.assert_called_once_with(
            in_reply_to_tweet_id=MOCK_TWEET_ID,
            text=MOCK_TWEET_REPLY,
        )
