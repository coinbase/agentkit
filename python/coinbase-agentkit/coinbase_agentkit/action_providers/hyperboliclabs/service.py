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

    def make_request(
        self,
        endpoint: str,
        method: str = "POST",
        data: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> requests.Response:
        """Make an API request to the service endpoint.

        Args:
            endpoint: The endpoint path to call.
            method: The HTTP method to use (default: "POST").
            data: Optional JSON body for the request.
            params: Optional query parameters.
            headers: Optional additional headers.

        Returns:
            requests.Response: The raw HTTP response object.

        Raises:
            requests.HTTPError: If the API returns an error response (4xx, 5xx),
                                with the error message and code extracted from the response when available.
            requests.RequestException: For other request-related errors.

        """
        if not headers:
            headers = {}
        headers.update(
            {"Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"}
        )

        url = f"{self.base_url}{endpoint}"
        response = requests.request(
            method=method, url=url, headers=headers, json=data, params=params
        )

        try:
            response.raise_for_status()
        except requests.HTTPError as e:
            try:
                error_json = response.json()
                error_message = error_json.get("message", "")
                error_code = error_json.get("error_code")

                if error_message or error_code:
                    enhanced_message = str(e)
                    if error_message:
                        enhanced_message += f": {error_message}"
                    if error_code:
                        enhanced_message += f" (code: {error_code})"

                    enriched_error = requests.HTTPError(enhanced_message, response=response)
                    raise enriched_error from e
            except ValueError:
                pass

            raise

        return response
