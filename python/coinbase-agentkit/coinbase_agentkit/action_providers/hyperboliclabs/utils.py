"""Utility functions for Hyperbolic action provider."""

import os


def get_api_key() -> str:
    """Get Hyperbolic API key from environment variables.

    Returns:
        str: The API key.

    Raises:
        ValueError: If API key is not configured.

    """
    api_key = os.getenv("HYPERBOLIC_API_KEY")
    if not api_key:
        raise ValueError("HYPERBOLIC_API_KEY is not configured.")
    return api_key


__all__ = [
    "get_api_key",
]
