from json import dumps
from unittest.mock import patch

import pytest
import tweepy
from cdp_agentkit_core.actions.social.twitter.account_mentions import (
    AccountMentionsInput,
    account_mentions,
)

MOCK_ACCOUNT_ID = "1234"


def test_account_mentions_input_model_valid():
    """Test that AccountMentionsInput accepts valid parameters."""
    input_model = AccountMentionsInput(
        account_id=MOCK_ACCOUNT_ID,
    )

    assert input_model.account_id == MOCK_ACCOUNT_ID


def test_account_mentions_input_model_missing_params():
    """Test that AccountMentionsInput raises error when params are missing."""
    with pytest.raises(ValueError):
        AccountMentionsInput()


def test_account_mentions_success(tweepy_factory):
    """Test successful retrieval of the authenticated Twitter (X) account's mentions."""
    mock_client = tweepy_factory()
    mock_client_result = {
        "data": [
            {
                "id": "1857479287504584856",
                "edit_history_tweet_ids": ["1857479287504584856"],
                "text": "@CDPAgentKit reply",
            },
        ],
        "meta": {
            "result_count": 1,
            "newest_id": "1857479287504584856",
            "oldest_id": "1857479287504584856",
        },
    }

    expected_response = f"Successfully retrieved authenticated user account mentions:\n{dumps(mock_client_result)}"

    with patch.object(mock_client, "get_users_mentions", return_value=mock_client_result) as mock_tweepy_get_users_mentions:
        response = account_mentions(mock_client, MOCK_ACCOUNT_ID)

        assert response == expected_response
        mock_tweepy_get_users_mentions.assert_called_once_with(MOCK_ACCOUNT_ID)


def test_account_mentions_failure(tweepy_factory):
    """Test failure when an API error occurs."""
    mock_client = tweepy_factory()

    expected_result = tweepy.errors.TweepyException("Tweepy Error")
    expected_response = f"Error retrieving authenticated user account mentions:\n{expected_result}"

    with patch.object(mock_client, "get_users_mentions", side_effect=expected_result) as mock_get_users_mentions:
        response = account_mentions(mock_client, MOCK_ACCOUNT_ID)
        assert response == expected_response
        mock_get_users_mentions.assert_called_once_with(MOCK_ACCOUNT_ID)
