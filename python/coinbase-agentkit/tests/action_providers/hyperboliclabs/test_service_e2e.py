"""End-to-end tests for the Base service class."""

import os
import pytest
import requests

from coinbase_agentkit.action_providers.hyperboliclabs.constants import API_BASE_URL
from coinbase_agentkit.action_providers.hyperboliclabs.service import Base


@pytest.mark.e2e
def test_make_api_request_success():
    """Test successful API request."""
    # This test requires an API key in the environment
    api_key = os.environ.get("HYPERBOLIC_API_KEY", "")
    if not api_key:
        pytest.skip("HYPERBOLIC_API_KEY environment variable not set")
    
    base = Base(api_key)
    
    # Make a request to a known endpoint that should succeed
    response = base.make_api_request(
        api_key=api_key,
        path=f"{API_BASE_URL}/health",
        method="GET"
    )
    
    assert isinstance(response, dict)
    assert "status" in response


@pytest.mark.e2e
def test_make_api_request_error():
    """Test API request with error response."""
    # This test requires an API key in the environment
    api_key = os.environ.get("HYPERBOLIC_API_KEY", "")
    if not api_key:
        pytest.skip("HYPERBOLIC_API_KEY environment variable not set")
    
    base = Base(api_key)
    
    # Make a request to a nonexistent endpoint that should fail
    with pytest.raises(requests.exceptions.HTTPError):
        base.make_api_request(
            api_key=api_key,
            path=f"{API_BASE_URL}/nonexistent-endpoint",
            method="GET"
        ) 