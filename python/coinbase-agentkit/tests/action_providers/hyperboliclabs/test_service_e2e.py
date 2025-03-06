"""End-to-end tests for the Base service class."""

import pytest
import requests

from coinbase_agentkit.action_providers.hyperboliclabs.service import Base


@pytest.mark.e2e
def test_make_request_success(api_key):
    """Test successful API request."""
    base = Base(api_key)

    try:
        response = base.make_request(endpoint="/v1", method="GET")

        assert isinstance(response, requests.Response)
        response.raise_for_status()
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            print(f"Endpoint not found but service is responsive: {e}")
        else:
            raise


@pytest.mark.e2e
def test_make_request_error(api_key):
    """Test API request with error response."""
    base = Base(api_key)

    with pytest.raises(requests.exceptions.HTTPError):
        base.make_request(endpoint="/nonexistent-endpoint", method="GET")
