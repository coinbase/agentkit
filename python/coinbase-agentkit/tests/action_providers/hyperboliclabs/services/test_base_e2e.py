"""End-to-end tests for Hyperbolic services.

These tests make real API calls to the Hyperbolic platform.
They require a valid API key in the HYPERBOLIC_API_KEY environment variable.
"""

import pytest
import requests

from coinbase_agentkit.action_providers.hyperboliclabs.services.base import Base


@pytest.mark.e2e
def test_error_handling_invalid_key():
    """Test error handling with invalid API key."""
    service = Base("invalid_key")

    with pytest.raises(requests.exceptions.HTTPError) as exc_info:
        service.make_request("/test")

    assert exc_info.value.response.status_code == 401 