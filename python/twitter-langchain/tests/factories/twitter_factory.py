from unittest.mock import MagicMock

import pytest
import tweepy


@pytest.fixture
def tweepy_factory():
    """Create and return a factory for tweepy mock fixtures."""

    def _create_tweepy():
        tweepy_mock = MagicMock(spec=tweepy.Client)
        return tweepy_mock

    return _create_tweepy
