from json import dumps
from unittest.mock import patch

import tweepy
from cdp_agentkit_core.actions.social.twitter.account_details import (
    account_details,
)

MOCK_ID = 1234
MOCK_NAME = "Test Account"
MOCK_USERNAME = "testaccount"


def test_account_details_success(tweepy_factory):
    """Test successful retrievial of the authenticated Twitter (X) account."""
    mock_client = tweepy_factory()
    mock_client_result = {
        "data": {
            "id": MOCK_ID,
            "name": MOCK_USERNAME,
            "username": MOCK_USERNAME,
        },
    }

    expected_result = mock_client_result.copy()
    expected_result["data"]["url"] = f"https://x.com/{MOCK_USERNAME}"
    expected_response = f"Successfully retrieved authenticated user account details:\n{dumps(expected_result)}"

    with patch.object(mock_client, "get_me", return_value=mock_client_result) as mock_tweepy_get_me:
        response = account_details(mock_client)

        assert response == expected_response
        mock_tweepy_get_me.assert_called_once_with()


def test_account_details_failure(tweepy_factory):
    """Test failure when an API error occurs."""
    mock_client = tweepy_factory()

    expected_result = tweepy.errors.TweepyException("Tweepy Error")
    expected_response = f"Error retrieving authenticated user account details:\n{expected_result}"

    with patch.object(mock_client, "get_me", side_effect=expected_result) as mock_tweepy_get_me:
        response = account_details(mock_client)

        assert response == expected_response
        mock_tweepy_get_me.assert_called_once_with()
