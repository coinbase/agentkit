"""Base service for making API requests to Hyperbolic platform."""

from typing import Any

import requests

from .constants import API_BASE_URL


class Base:
    """Base class with common functionality."""

    def __init__(self, api_key: str, base_url: str | None = None):
        """Initialize the service.

        Args:
            api_key: The API key for authentication.
            base_url: Optional base URL for the service. If not provided,
                     will use API_BASE_URL from constants.

        """
        self.api_key = api_key
        self.base_url = base_url or API_BASE_URL

    def make_api_request(
        self,
        api_key: str,
        path: str,
        method: str = "POST",
        data: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        if not headers:
            headers = {}
        headers.update({"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"})

        response = requests.request(
            method=method, url=path, headers=headers, json=data, params=params
        )
        if not response.ok:
            print("\nAPI Error Response:", response.text)
        response.raise_for_status()
        return response.json()

    def make_request(
        self,
        endpoint: str,
        method: str = "POST",
        data: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        """Make an API request to the service endpoint.

        Args:
            endpoint: The endpoint path to call.
            method: The HTTP method to use (default: "POST").
            data: Optional JSON body for the request.
            params: Optional query parameters.
            headers: Optional additional headers.

        Returns:
            dict[str, Any]: The API response data.

        Raises:
            requests.exceptions.RequestException: If the API request fails.

        """
        return self.make_api_request(
            api_key=self.api_key,
            path=f"{self.base_url}{endpoint}",
            method=method,
            data=data,
            params=params,
            headers=headers,
        ) 