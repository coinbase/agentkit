"""Services for making API requests to Hyperbolic platform.

This module provides service classes for making API requests to specific Hyperbolic endpoints.
Each service class handles domain-specific endpoints and uses the base make_api_request function.
"""

from .base import Base
from .settings import Settings


class Hyperbolic:
    """Main service container providing access to all Hyperbolic services."""

    def __init__(self, api_key: str):
        """Initialize all services.

        Args:
            api_key: The API key for authentication.

        """
        self.settings = Settings(api_key)


__all__ = ["Hyperbolic", "Base", "Settings"] 