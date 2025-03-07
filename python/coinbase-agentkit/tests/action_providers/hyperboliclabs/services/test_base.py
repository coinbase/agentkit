"""Tests for Hyperbolic Base service."""

import pytest
import requests

from coinbase_agentkit.action_providers.hyperboliclabs.services.base import Base

from ..conftest import TEST_API_KEY


def test_base_service_init():
    """Test Base service initialization."""
    service = Base(TEST_API_KEY)
    assert service.api_key == TEST_API_KEY

    custom_url = "https://custom.api.com"
    service_with_url = Base(TEST_API_KEY, custom_url)
    assert service_with_url.base_url == custom_url


def test_base_service_make_request(mock_request):
    """Test Base service make_request method."""
    service = Base(TEST_API_KEY)
    mock_request.return_value.json.return_value = {"status": "success"}

    # Test basic GET request
    response = service.make_request("/test")
    assert response == {"status": "success"}
    mock_request.assert_called_once()

    # Test POST request with parameters
    data = {"key": "value"}
    params = {"query": "param"}
    custom_headers = {"Custom": "Header"}

    response = service.make_request(
        endpoint="/test", method="POST", data=data, params=params, headers=custom_headers
    )
    assert response == {"status": "success"}
    assert mock_request.call_count == 2


def test_base_service_make_request_error(mock_request):
    """Test Base service error handling."""
    service = Base(TEST_API_KEY)
    mock_request.side_effect = requests.exceptions.HTTPError("500 Server Error")

    with pytest.raises(requests.exceptions.HTTPError, match="500 Server Error"):
        service.make_request("/test")


def test_base_service_make_request_invalid_method():
    """Test Base service with invalid HTTP method."""
    service = Base(TEST_API_KEY)

    with pytest.raises(ValueError, match="Invalid HTTP method"):
        service.make_request("/test", method="INVALID") 