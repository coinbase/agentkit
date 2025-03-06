"""Unit tests for the Base service class."""

from unittest.mock import patch

import pytest
import requests

from coinbase_agentkit.action_providers.hyperboliclabs.service import Base


@pytest.fixture
def mock_request():
    """Mock the request function for testing."""
    with patch(
        "coinbase_agentkit.action_providers.hyperboliclabs.service.requests.request"
    ) as mock:
        mock.return_value.status_code = 200
        mock.return_value.json.return_value = {"status": "success"}
        mock.return_value.raise_for_status.return_value = None
        yield mock


def test_init():
    """Test Base class initialization."""
    base = Base("test_api_key")
    assert base.api_key == "test_api_key"
    assert base.base_url is not None


def test_make_request():
    """Test make_request method."""
    base = Base("test_api_key", "https://api.example.com")

    with patch(
        "coinbase_agentkit.action_providers.hyperboliclabs.service.requests.request"
    ) as mock_request:
        mock_response = mock_request.return_value
        mock_response.json.return_value = {"status": "success"}
        mock_response.ok = True

        response = base.make_request("/test")

        mock_request.assert_called_once()
        assert response is mock_response
        assert response.json() == {"status": "success"}


def test_service_init(mock_api_key):
    """Test Base service initialization."""
    service = Base(mock_api_key)
    assert service.api_key == mock_api_key

    custom_url = "https://custom.api.com"
    service_with_url = Base(mock_api_key, custom_url)
    assert service_with_url.base_url == custom_url


def test_service_make_request(mock_request, mock_api_key):
    """Test Base service make_request method."""
    service = Base(mock_api_key)
    mock_response = mock_request.return_value
    mock_response.json.return_value = {"status": "success"}

    response = service.make_request("/test")
    assert response is mock_response
    assert response.json() == {"status": "success"}
    mock_request.assert_called_once()

    data = {"key": "value"}
    params = {"query": "param"}
    custom_headers = {"Custom": "Header"}

    response = service.make_request(
        endpoint="/test", method="POST", data=data, params=params, headers=custom_headers
    )
    assert response is mock_response
    assert response.json() == {"status": "success"}
    assert mock_request.call_count == 2


def test_service_make_request_error(mock_request, mock_api_key):
    """Test Base service error handling."""
    service = Base(mock_api_key)
    mock_request.side_effect = requests.exceptions.HTTPError("500 Server Error")

    with pytest.raises(requests.exceptions.HTTPError, match="500 Server Error"):
        service.make_request("/test")


def test_service_make_request_invalid_method(mock_request, mock_api_key):
    """Test Base service with invalid HTTP method."""
    service = Base(mock_api_key)

    mock_request.side_effect = ValueError("Invalid HTTP method: INVALID")

    with pytest.raises(ValueError, match="Invalid HTTP method"):
        service.make_request("/test", method="INVALID")
