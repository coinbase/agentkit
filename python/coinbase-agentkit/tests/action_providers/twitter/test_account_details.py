"""Tests for Twitter account details action."""

from json import dumps
from unittest.mock import patch

import pytest
import tweepy

from coinbase_agentkit.action_providers.twitter.schemas import AccountDetailsSchema
from coinbase_agentkit.action_providers.twitter.twitter_action_provider import (
    twitter_action_provider,
)

MOCK_ID = 1234
MOCK_NAME = "Test Account"
MOCK_USERNAME = "testaccount"


def test_account_details_input_model_valid():
    """Test that AccountDetailsInput accepts valid parameters."""
    input_model = AccountDetailsSchema(**{})
    assert isinstance(input_model, AccountDetailsSchema)


@pytest.mark.usefixtures("mock_env")
def test_account_details_success():
    """Test successful retrieval of the authenticated Twitter (X) account."""
    provider = twitter_action_provider()

    mock_response = {"data": {"id": MOCK_ID, "name": MOCK_NAME, "username": MOCK_USERNAME}}
    mock_response["data"]["url"] = f"https://x.com/{MOCK_USERNAME}"

    expected_response = (
        f"Successfully retrieved authenticated user account details:\n{dumps(mock_response)}"
    )

    with patch.object(provider.client, "get_me", return_value=mock_response) as mock_get_me:
        response = provider.account_details({})

        assert response == expected_response
        mock_get_me.assert_called_once_with()


@pytest.mark.usefixtures("mock_env")
def test_account_details_failure():
    """Test failure when an API error occurs."""
    provider = twitter_action_provider()
    error = tweepy.errors.TweepyException("Tweepy Error")
    expected_response = f"Error retrieving authenticated user account details:\n{error}"

    with patch.object(provider.client, "get_me", side_effect=error) as mock_get_me:
        response = provider.account_details({})

        assert response == expected_response
        mock_get_me.assert_called_once_with()
