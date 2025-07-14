"""x402 action provider."""

import json
from typing import Any

import requests
from x402.clients.base import decode_x_payment_response
from x402.clients.requests import x402_requests
from x402.types import PaymentRequirements

from ...network import Network
from ...wallet_providers.evm_wallet_provider import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import DirectX402RequestSchema, HttpRequestSchema, RetryWithX402Schema

SUPPORTED_NETWORKS = ["base-mainnet", "base-sepolia"]


class x402ActionProvider(ActionProvider[EvmWalletProvider]):  # noqa: N801
    """Provides actions for interacting with x402.

    This provider enables making HTTP requests to x402-protected endpoints with optional payment handling.
    It supports both a recommended two-step flow and a direct payment flow.
    """

    def __init__(self):
        super().__init__("x402", [])

    @create_action(
        name="make_http_request",
        description="""
Makes a basic HTTP request to an API endpoint. If the endpoint requires payment (returns 402),
it will return payment details that can be used with retry_http_request_with_x402.

EXAMPLES:
- Production API: make_http_request("https://api.example.com/weather")
- Local development: make_http_request("http://localhost:3000/api/data")
- Testing x402: make_http_request("http://localhost:3000/protected")

If you receive a 402 Payment Required response, use retry_http_request_with_x402 to handle the payment.""",
        schema=HttpRequestSchema,
    )
    def make_http_request(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Make initial HTTP request and handle 402 responses.

        Args:
            wallet_provider: The wallet provider (not used for initial request).
            args: Request parameters including URL, method, headers, and body.

        Returns:
            str: JSON string containing response data or payment requirements.
        """
        try:
            response = requests.request(
                url=args["url"],
                method=args["method"] or "GET",
                headers=args.get("headers"),
                data=args.get("body"),
            )

            # Handle non-402 responses
            if response.status_code != 402:
                return json.dumps(
                    {
                        "success": True,
                        "url": args["url"],
                        "method": args["method"],
                        "status": response.status_code,
                        "data": response.json() if "application/json" in response.headers.get("content-type", "") else response.text,
                    },
                    indent=2,
                )

            # Parse payment requirements from 402 response
            payment_requirements = [
                PaymentRequirements(**accept) for accept in response.json().get("accepts", [])
            ]

            return json.dumps(
                {
                    "status": "error_402_payment_required",
                    "acceptablePaymentOptions": [req.dict() for req in payment_requirements],
                    "nextSteps": [
                        "Inform the user that the requested server replied with a 402 Payment Required response.",
                        f"The payment options are: {', '.join(f'{req.asset} {req.max_amount_required} {req.network}' for req in payment_requirements)}",
                        "Ask the user if they want to retry the request with payment.",
                        "Use retry_http_request_with_x402 to retry the request with payment.",
                    ],
                },
                indent=2,
            )

        except Exception as error:
            return self._handle_http_error(error, args["url"])

    @create_action(
        name="retry_http_request_with_x402",
        description="""
Retries an HTTP request with x402 payment after receiving a 402 Payment Required response.
This should be used after make_http_request returns a 402 response.

EXAMPLE WORKFLOW:
1. First call make_http_request("http://localhost:3000/protected")
2. If you get a 402 response, use this action to retry with payment
3. Pass the entire original response to this action

DO NOT use this action directly without first trying make_http_request!""",
        schema=RetryWithX402Schema,
    )
    def retry_with_x402(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """Retry a request with x402 payment after receiving payment details."""
        try:
            # Convert snake_case args to camelCase for x402 API
            payment_data = {
                "scheme": args["scheme"],
                "network": args["network"],
                "maxAmountRequired": args["max_amount_required"],
                "resource": args["resource"],
                "payTo": args["pay_to"],
                "maxTimeoutSeconds": args["max_timeout_seconds"],
                "asset": args["asset"],
                "description": args.get("description", ""),
                "mimeType": args.get("mime_type", ""),
                "outputSchema": args.get("output_schema"),
                "extra": args.get("extra")
            }

            # Make request with payment handling
            account = wallet_provider.to_signer()
            session = x402_requests(account)

            # Pass the payment data to the session request
            response = session.request(
                url=args["url"],
                method=args["method"] or "GET",
                headers=args.get("headers"),
                data=args.get("body"),
            )

            # Extract payment proof if available
            payment_proof = None
            if "x-payment-response" in response.headers:
                try:
                    payment_proof = decode_x_payment_response(response.headers["x-payment-response"])
                except Exception as e:
                    print("Failed to decode payment proof:", str(e))
                    pass

            return json.dumps(
                {
                    "status": "success",
                    "data": response.json() if "application/json" in response.headers.get("content-type", "") else response.text,
                    "message": "Request completed successfully with payment",
                    "details": {
                        "url": args["url"],
                        "method": args["method"],
                        "paymentUsed": {
                            "network": args["network"],
                            "asset": args["asset"],
                            "amount": args["max_amount_required"],
                        },
                        "paymentProof": {
                            "transaction": payment_proof["transaction"],
                            "network": payment_proof["network"],
                            "payer": payment_proof["payer"],
                        } if payment_proof else None,
                    },
                },
                indent=2,
            )

        except Exception as error:
            return self._handle_http_error(error, args["url"])

    @create_action(
        name="make_http_request_with_x402",
        description="""
⚠️ WARNING: This action automatically handles payments without asking for confirmation!
Only use this when explicitly told to skip the confirmation flow.

For most cases, you should:
1. First try make_http_request
2. Then use retry_http_request_with_x402 if payment is required

This action combines both steps into one, which means:
- No chance to review payment details before paying
- No confirmation step
- Automatic payment processing

EXAMPLES:
- Production: make_http_request_with_x402("https://api.example.com/data")
- Local dev: make_http_request_with_x402("http://localhost:3000/protected")

Unless specifically instructed otherwise, prefer the two-step approach with make_http_request first.""",
        schema=DirectX402RequestSchema,
    )
    def make_http_request_with_x402(
        self, wallet_provider: EvmWalletProvider, args: dict[str, Any]
    ) -> str:
        """Make HTTP request with automatic x402 payment handling.

        Args:
            wallet_provider: The wallet provider to use for payment signing.
            args: Request parameters including URL, method, headers, and body.

        Returns:
            str: JSON string containing response data and optional payment proof.
        """
        try:
            account = wallet_provider.to_signer()
            session = x402_requests(account)

            response = session.request(
                url=args["url"],
                method=args["method"] or "GET",
                headers=args.get("headers"),
                data=args.get("body"),
            )

            # Extract payment proof if available
            payment_proof = None
            if "x-payment-response" in response.headers:
                try:
                    payment_proof = decode_x_payment_response(response.headers["x-payment-response"])
                except Exception as e:
                    print("Failed to decode payment proof:", str(e))
                    pass

            return json.dumps(
                {
                    "success": True,
                    "message": "Request completed successfully (payment handled automatically if required)",
                    "url": args["url"],
                    "method": args["method"],
                    "status": response.status_code,
                    "data": response.json() if "application/json" in response.headers.get("content-type", "") else response.text,
                    "paymentProof": {
                        "transaction": payment_proof["transaction"],
                        "network": payment_proof["network"],
                        "payer": payment_proof["payer"],
                    } if payment_proof else None,
                },
                indent=2,
            )

        except Exception as error:
            return self._handle_http_error(error, args["url"])

    def _handle_http_error(self, error: Exception, url: str) -> str:
        """Handle HTTP errors consistently.

        Args:
            error: The error that occurred.
            url: The URL that was being accessed.

        Returns:
            str: JSON string containing formatted error details.
        """
        if hasattr(error, "response") and error.response is not None:
            error_details = getattr(error.response, "json", lambda: {"error": str(error)})()
            return json.dumps(
                {
                    "error": True,
                    "message": f"HTTP {error.response.status_code} error when accessing {url}",
                    "details": error_details.get("error", str(error)),
                    "suggestion": "Check if the URL is correct and the API is available.",
                },
                indent=2,
            )

        if hasattr(error, "request") and error.request is not None:
            return json.dumps(
                {
                    "error": True,
                    "message": f"Network error when accessing {url}",
                    "details": str(error),
                    "suggestion": "Check your internet connection and verify the API endpoint is accessible.",
                },
                indent=2,
            )

        return json.dumps(
            {
                "error": True,
                "message": f"Error making request to {url}",
                "details": str(error),
                "suggestion": "Please check the request parameters and try again.",
            },
            indent=2,
        )

    def supports_network(self, network: Network) -> bool:
        """Check if the network is supported by this action provider.

        Args:
            network: The network to check support for.

        Returns:
            bool: Whether the network is supported.
        """
        return network.protocol_family == "evm" and network.network_id in SUPPORTED_NETWORKS


def x402_action_provider() -> x402ActionProvider:
    """Create a new x402 action provider.

    Returns:
        x402ActionProvider: A new x402 action provider instance.
    """
    return x402ActionProvider()
