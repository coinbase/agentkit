"""Unit tests for the Base service class."""

from unittest.mock import patch
import pytest
import requests

from coinbase_agentkit.action_providers.hyperboliclabs.service import Base


@pytest.fixture
def mock_request():
    """Mock the request function for testing."""
    with patch("coinbase_agentkit.action_providers.hyperboliclabs.service.requests.request") as mock:
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
    
    with patch("coinbase_agentkit.action_providers.hyperboliclabs.service.requests.request") as mock_request:
        mock_request.return_value.json.return_value = {"status": "success"}
        mock_request.return_value.ok = True
        
        # Call the method
        response = base.make_request("/test")
        
        # Check that the right calls were made
        mock_request.assert_called_once()
        assert response == {"status": "success"}


def test_base_service_init(api_key):
    """Test Base service initialization."""
    service = Base(api_key)
    assert service.api_key == api_key

    custom_url = "https://custom.api.com"
    service_with_url = Base(api_key, custom_url)
    assert service_with_url.base_url == custom_url


def test_base_service_make_request(mock_request, api_key):
    """Test Base service make_request method."""
    service = Base(api_key)
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


def test_base_service_make_request_error(mock_request, api_key):
    """Test Base service error handling."""
    service = Base(api_key)
    mock_request.side_effect = requests.exceptions.HTTPError("500 Server Error")

    with pytest.raises(requests.exceptions.HTTPError, match="500 Server Error"):
        service.make_request("/test")


def test_base_service_make_request_invalid_method(api_key):
    """Test Base service with invalid HTTP method."""
    service = Base(api_key)

    with pytest.raises(ValueError, match="Invalid HTTP method"):
        service.make_request("/test", method="INVALID") 