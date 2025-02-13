"""Shared fixtures for Twitter action provider tests."""

import pytest


@pytest.fixture
def mock_env(monkeypatch):
    """Set up mock environment variables for Twitter credentials."""
    monkeypatch.setenv("TWITTER_API_KEY", "mock_api_key")
    monkeypatch.setenv("TWITTER_API_SECRET", "mock_api_secret")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN", "mock_access_token")
    monkeypatch.setenv("TWITTER_ACCESS_TOKEN_SECRET", "mock_access_token_secret")
    monkeypatch.setenv("TWITTER_BEARER_TOKEN", "mock_bearer_token")
