"""Utility functions for Hyperbolic actions."""

import os

def get_api_key() -> str:
    """Get the Hyperbolic API key from environment variables.

    Returns:
        str: The API key

    Raises:
        ValueError: If HYPERBOLIC_API_KEY is not set in environment variables

    """
    api_key = os.getenv("HYPERBOLIC_API_KEY")
    if not api_key:
        raise ValueError("HYPERBOLIC_API_KEY environment variable is not set")
    return api_key
