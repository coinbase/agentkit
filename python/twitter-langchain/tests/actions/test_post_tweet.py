from json import dumps
from unittest.mock import patch

import pytest
import tweepy
from cdp_agentkit_core.actions.social.twitter.post_tweet import (
    PostTweetInput,
    post_tweet,
)

MOCK_TWEET = "hello, world!"


def test_post_tweet_input_model_valid():
    """Test that PostTweetInput accepts valid parameters."""
    input_model = PostTweetInput(
        tweet=MOCK_TWEET,
    )

    assert input_model.tweet == MOCK_TWEET


def test_post_tweet_input_model_missing_params():
    """Test that PostTweetInput raises error when params are missing."""
    with pytest.raises(ValueError):
        PostTweetInput()


def test_post_tweet_success(tweepy_factory):
    """Test successful tweet post to the authenticated Twitter (X) account."""
    mock_client = tweepy_factory()
    mock_client_result = {
        "data": {
            "text": "hello, world!",
            "id": "0123456789012345678",
            "edit_history_tweet_ids": ["0123456789012345678"],
        }
    }

    expected_response = f"Successfully posted to Twitter:\n{dumps(mock_client_result)}"

    with patch.object(mock_client, "create_tweet", return_value=mock_client_result) as mock_tweepy_create_tweet:
        response = post_tweet(mock_client, MOCK_TWEET)

        assert response == expected_response
        mock_tweepy_create_tweet.assert_called_once_with(text=MOCK_TWEET)


def test_post_tweet_failure(tweepy_factory):
    """Test failure when an API error occurs."""
    mock_client = tweepy_factory()

    expected_result = tweepy.errors.TweepyException("Tweepy Error")
    expected_response = f"Error posting to Twitter:\n{expected_result}"

    with patch.object(mock_client, "create_tweet", side_effect=expected_result) as mock_tweepy_create_tweet:
        response = post_tweet(mock_client, MOCK_TWEET)
        assert response == expected_response
        mock_tweepy_create_tweet.assert_called_once_with(text=MOCK_TWEET)
