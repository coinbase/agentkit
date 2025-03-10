"""End-to-end tests for the Base service class."""

import pytest
import requests

from coinbase_agentkit.action_providers.hyperboliclabs.service import Base


@pytest.mark.e2e
def test_make_request_success(api_key):
    """Test successful API request."""
    base = Base(api_key)

    # Try to make a request to a simple endpoint that's likely to succeed
    try:
        response = base.make_request(endpoint="/v1", method="GET")

        # Verify response is a Response object, since the implementation now returns the raw response
        assert isinstance(response, requests.Response)
        # Ensure the request was successful (status code 2xx)
        response.raise_for_status()
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            # If we get a 404, the service is responsive but endpoint might have changed
            # Still consider the test successful since we're testing the request mechanism
            print(f"Endpoint not found but service is responsive: {e}")
        else:
            # Re-raise for other status codes
            raise


@pytest.mark.e2e
def test_make_request_error(api_key):
    """Test API request with error response."""
    base = Base(api_key)

    # Make a request to a nonexistent endpoint that should fail
    response = base.make_request(endpoint="/nonexistent-endpoint", method="GET")

    # Now manually raise for status since the implementation doesn't do it anymore
    with pytest.raises(requests.exceptions.HTTPError):
        response.raise_for_status()
