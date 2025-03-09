"""Common test fixtures for Hyperbolic services."""

import os
import pytest


@pytest.fixture
def api_key() -> str:
    """Get API key for testing.
    
    Returns:
        str: API key from environment.
        
    Skips the test if HYPERBOLIC_API_KEY is not set.
    """
    api_key = os.environ.get("HYPERBOLIC_API_KEY", "")
    if not api_key:
        pytest.skip("HYPERBOLIC_API_KEY environment variable not set")
    return api_key 