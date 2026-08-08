"""x402 action provider."""

from __future__ import annotations

import base64
import json
import os
from typing import Any

import requests
from x402 import x402ClientSync
from x402.http.clients.requests import x402_requests
from x402.mechanisms.evm import EthAccountSigner
from x402.mechanisms.evm.exact.register import register_exact_evm_client

from ...network import Network
from ...wallet_providers.evm_wallet_provider import EvmWalletProvider
from ...wallet_providers.wallet_provider import WalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .constants import KNOWN_FACILITATORS, SUPPORTED_NETWORKS
from .schemas import (
    DirectX402RequestSchema,
    EmptySchema,
    HttpRequestSchema,
    ListX402ServicesSchema,
    RegisterServiceSchema,
    RetryWithX402Schema,
    X402Config,
)
from .utils import (
    build_url_with_params,
    fetch_all_discovery_resources,
    filter_by_description,
    filter_by_keyword,
    filter_by_max_price,
    filter_by_network,
    filter_by_x402_version,
    filter_usdc_payment_options,
    format_payment_option,
    format_simplified_resources,
    get_x402_networks,
    handle_http_error,
    is_url_allowed,
    is_usdc_asset,
    validate_facilitator,
    validate_payment_limit,
)


class x402ActionProvider(ActionProvider[WalletProvider]):  # noqa: N801
    """Provides actions for interacting with x402.

    This provider enables making HTTP requests to x402-protected endpoints with optional payment handling.
    It supports both a recommended two-step flow and a direct payment flow.
    """

    def __init__(self, config: X402Config | None = None):
        """Initialize x402 action provider.

        Args:
            config: Optional configuration for service registration and payment limits

        """
        super().__init__("x402", [])

        if config is None:
            config = X402Config()

        # Resolve configuration with environment variable fallbacks
        self._config = X402Config(
            registered_services=config.registered_services,
            allow_dynamic_service_registration=(
                config.allow_dynamic_service_registration
                or os.getenv("X402_ALLOW_DYNAMIC_SERVICE_REGISTRATION", "").lower() == "true"
            ),
            registered_facilitators=config.registered_facilitators,
            max_payment_usdc=(
                config.max_payment_usdc
                if config.max_payment_usdc != 1.0
                else float(os.getenv("X402_MAX_PAYMENT_USDC", "1.0"))
            ),
        )

        self._registered_services: set[str] = set(self._config.registered_services)

    @create_action(
        name="discover_x402_services",
        description="""Discover available x402 services. Only services available on the current network will be returned. Optionally filter by a maximum price in whole units of USDC (only USDC payment options will be considered when filter is applied).""",
        schema=ListX402ServicesSchema,
    )
    def discover_x402_services(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        """Discover available x402 services with optional filtering.

        Args:
            wallet_provider: The wallet provider to use for network filtering
            args: Optional filters: facilitator, max_usdc_price, x402_versions, keyword

        Returns:
            str: JSON string with the list of services (filtered by network and description)

        """
        try:
            # Validate facilitator is allowed (known name or registered name)
            facilitator = args.get("facilitator", "cdp")
            validation = validate_facilitator(facilitator, self._config.registered_facilitators)

            if not validation["is_allowed"]:
                known_names = list(KNOWN_FACILITATORS.keys())
                custom_names = list(self._config.registered_facilitators.keys())
                all_names = known_names + custom_names
                return json.dumps(
                    {
                        "error": True,
                        "message": "Facilitator not allowed",
                        "details": f'The facilitator "{facilitator}" is not recognized. Use one of: {", ".join(all_names)}',
                    },
                    indent=2,
                )

            discovery_url = validation["resolved_url"] + "/discovery/resources"

            # Fetch all resources with pagination
            all_resources = fetch_all_discovery_resources(discovery_url)

            if len(all_resources) == 0:
                return json.dumps(
                    {
                        "error": True,
                        "message": "No services found",
                    }
                )

            # Get the wallet's network identifiers (both v1 and v2 formats)
            wallet_networks = get_x402_networks(wallet_provider.get_network())

            # Apply filter pipeline
            filtered_resources = filter_by_network(all_resources, wallet_networks)
            filtered_resources = filter_by_description(filtered_resources)
            filtered_resources = filter_by_x402_version(
                filtered_resources, args.get("x402_versions", [1, 2])
            )

            # Apply keyword filter if provided
            keyword = args.get("keyword")
            if keyword:
                filtered_resources = filter_by_keyword(filtered_resources, keyword)

            # Apply price filter
            max_usdc_price = args.get("max_usdc_price", 1.0)
            filtered_resources = filter_by_max_price(
                filtered_resources,
                max_usdc_price,
                wallet_provider,
                wallet_networks,
            )

            # Format simplified output
            simplified_resources = format_simplified_resources(
                filtered_resources,
                wallet_networks,
                wallet_provider,
            )

            return json.dumps(
                {
                    "success": True,
                    "services": simplified_resources,
                    "walletNetworks": wallet_networks,
                    "total": len(all_resources),
                    "returned": len(simplified_resources),
                },
                indent=2,
            )

        except Exception as error:
            message = str(error)
            return json.dumps(
                {
                    "error": True,
                    "message": "Failed to list x402 services",
                    "details": message,
                },
                indent=2,
            )

    @create_action(
        name="make_http_request",
        description="""
Makes a basic HTTP request to an API endpoint. If the endpoint requires payment (returns 402),
it will return payment details that can be used with retry_http_request_with_x402.

EXAMPLES:
- Production API: make_http_request("https://api.example.com/weather")
- Local development: make_http_request("http://localhost:3000/api/data")

If you receive a 402 Payment Required response, use retry_http_request_with_x402 to handle the payment.""",
        schema=HttpRequestSchema,
    )
    def make_http_request(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        """Make initial HTTP request and handle 402 responses.

        Args:
            wallet_provider: The wallet provider (not used for initial request).
            args: Request parameters including URL, method, headers, and body.

        Returns:
            str: JSON string containing response data or payment requirements.

        """
        try:
            url = args["url"]

            # Check if service is registered
            if not is_url_allowed(url, self._registered_services):
                suggestion = (
                    "Use register_x402_service to register this service first."
                    if self._config.allow_dynamic_service_registration
                    else "Dynamic service registration is disabled. Only pre-registered services can be used. Set allow_dynamic_service_registration to True in the agent configuration to enable dynamic service registration."
                )
                return json.dumps(
                    {
                        "error": True,
                        "message": "Service not registered",
                        "details": f'The service URL "{url}" is not registered. Only approved services can be called.',
                        "registeredServices": list(self._registered_services),
                        "suggestion": suggestion,
                    },
                    indent=2,
                )

            final_url = build_url_with_params(url, args.get("query_params"))
            method = args.get("method") or "GET"
            can_have_body = method in ["POST", "PUT", "PATCH"]

            response = requests.request(
                url=final_url,
                method=method,
                headers=args.get("headers"),
                json=args.get("body") if can_have_body else None,
                timeout=30,
            )

            # Never silently retry with a different HTTP method: flipping GET to
            # POST turns an intended read into a possible write on services that
            # map both methods to the same path. Surface the 404 with a hint and
            # let the agent choose explicitly. (Parity with TypeScript #1405.)
            if response.status_code == 404:
                data = self._parse_response_data(response)
                return json.dumps(
                    {
                        "success": False,
                        "url": final_url,
                        "method": method,
                        "status": 404,
                        "data": data,
                        "hint": (
                            f"The service returned 404 for {method}. If it expects a "
                            "different method, call this action again with that method explicitly."
                        ),
                    },
                    indent=2,
                )

            if response.status_code != 402:
                data = self._parse_response_data(response)
                return json.dumps(
                    {
                        "success": True,
                        "url": final_url,
                        "method": method,
                        "status": response.status_code,
                        "data": data,
                    },
                    indent=2,
                )

            # Handle 402 Payment Required
            # v2 sends requirements in PAYMENT-REQUIRED header; v1 sends in body
            wallet_networks = get_x402_networks(wallet_provider.get_network())

            accepts_array: list[dict[str, Any]] = []
            payment_data: dict[str, Any] = {}

            # Check for v2 header-based payment requirements
            payment_required_header = response.headers.get("payment-required")
            if payment_required_header:
                try:
                    decoded = json.loads(base64.b64decode(payment_required_header))
                    accepts_array = decoded.get("accepts", [])
                    payment_data = decoded
                except Exception:
                    # Header parsing failed, fall back to body
                    pass

            # Fall back to v1 body-based requirements if header not present or empty
            if len(accepts_array) == 0:
                payment_data = response.json()
                accepts_array = payment_data.get("accepts", [])

            # Filter to USDC-only payment options
            usdc_options = filter_usdc_payment_options(accepts_array, wallet_provider)
            available_networks = [opt.get("network", "") for opt in usdc_options]
            has_matching_network = any(net in wallet_networks for net in available_networks)

            # Check if no USDC options available
            if len(usdc_options) == 0:
                return json.dumps(
                    {
                        "error": True,
                        "message": "No USDC payment option available",
                        "details": "This service does not accept USDC payments. Only USDC payments are supported.",
                        "originalOptions": accepts_array,
                    },
                    indent=2,
                )

            payment_options_text = f"The wallet networks {', '.join(wallet_networks)} do not match any available USDC payment options ({', '.join(available_networks)})."

            if has_matching_network:
                matching_options = [
                    opt for opt in usdc_options if opt.get("network") in wallet_networks
                ]
                formatted_options = [
                    format_payment_option(
                        {
                            "asset": opt.get("asset", ""),
                            "max_amount_required": opt.get("maxAmountRequired")
                            or opt.get("max_amount_required")
                            or opt.get("amount")
                            or "0",
                            "network": opt.get("network", ""),
                        },
                        wallet_provider,
                    )
                    for opt in matching_options
                ]
                payment_options_text = (
                    f"The USDC payment options are: {', '.join(formatted_options)}"
                )

            # Extract discovery info from v2 response (description, mimeType, extensions)
            discovery_info: dict[str, Any] = {}
            if payment_data.get("description"):
                discovery_info["description"] = payment_data["description"]
            if payment_data.get("mimeType"):
                discovery_info["mimeType"] = payment_data["mimeType"]
            if payment_data.get("extensions"):
                discovery_info["extensions"] = payment_data["extensions"]

            result: dict[str, Any] = {
                "status": "error_402_payment_required",
                "acceptablePaymentOptions": usdc_options,
                "nextSteps": [
                    "Inform the user that the requested server replied with a 402 Payment Required response.",
                    payment_options_text,
                    "Include the description of the service in the response.",
                    "IMPORTANT: Identify required or optional query or body parameters based on this response. If there are any, you must inform the user and request them to provide the values. Always suggest example values.",
                    "CRITICAL: For POST/PUT/PATCH requests, you MUST use the 'body' parameter (NOT query_params) to send data.",
                    "Ask the user if they want to retry the request with payment."
                    if has_matching_network
                    else "",
                    "CRITICAL: When calling retry_http_request_with_x402, you MUST pass the EXACT payment option object from acceptablePaymentOptions as selected_payment_option. Do NOT modify, interpret, or convert any values. The 'amount' field is in atomic units (e.g., '10000' = 0.01 USDC) and must be passed exactly as-is."
                    if has_matching_network
                    else "",
                ],
            }

            if discovery_info:
                result["discoveryInfo"] = discovery_info

            return json.dumps(result, indent=2)

        except Exception as error:
            return handle_http_error(error, args["url"])

    @create_action(
        name="retry_http_request_with_x402",
        description="""
Retries an HTTP request with x402 payment after receiving a 402 Payment Required response.
This should be used after make_http_request returns a 402 response.

EXAMPLE WORKFLOW:
1. First call make_http_request("http://localhost:3000/protected")
2. If you get a 402 response with acceptablePaymentOptions, use this action to retry with payment
3. CRITICAL: Pass the EXACT payment option object from acceptablePaymentOptions as selected_payment_option.
   Do NOT modify any values - the 'amount' field is in atomic units (e.g., '10000' means 0.01 USDC).

DO NOT use this action directly without first trying make_http_request!""",
        schema=RetryWithX402Schema,
    )
    def retry_with_x402(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        """Retry a request with x402 payment after receiving payment details.

        Args:
            wallet_provider: The wallet provider to use for making the payment
            args: Request parameters including URL, method, headers, body, and payment option

        Returns:
            str: JSON string containing the response with payment details or error information

        """
        try:
            url = args["url"]

            # Check if service is registered
            if not is_url_allowed(url, self._registered_services):
                return json.dumps(
                    {
                        "error": True,
                        "message": "Service not registered",
                        "details": f'The service URL "{url}" is not registered. Only pre-registered services can be called.',
                        "registeredServices": list(self._registered_services),
                    },
                    indent=2,
                )

            # Get selected payment option (PaymentOptionSchema Pydantic model)
            selected_payment_option = args["selected_payment_option"]

            # Check that payment option is USDC
            asset = selected_payment_option.asset or ""
            if not is_usdc_asset(asset, wallet_provider):
                return json.dumps(
                    {
                        "error": True,
                        "message": "Only USDC payments are supported",
                        "details": f'The selected payment asset "{asset}" is not USDC.',
                    },
                    indent=2,
                )

            # Validate payment amount against limit
            payment_amount = (
                selected_payment_option.max_amount_required
                or selected_payment_option.amount
                or selected_payment_option.price
                or "0"
            )
            payment_validation = validate_payment_limit(
                payment_amount, self._config.max_payment_usdc
            )
            if not payment_validation["is_valid"]:
                return json.dumps(
                    {
                        "error": True,
                        "message": "Payment exceeds limit",
                        "details": f'The requested payment of {payment_validation["requested_amount"]} USDC exceeds the maximum spending limit of {payment_validation["max_amount"]} USDC.',
                        "maxPaymentUsdc": self._config.max_payment_usdc,
                    },
                    indent=2,
                )

            # Check network compatibility before attempting payment
            wallet_networks = get_x402_networks(wallet_provider.get_network())
            selected_network = selected_payment_option.network or ""

            if selected_network not in wallet_networks:
                return json.dumps(
                    {
                        "error": True,
                        "message": "Network mismatch",
                        "details": f'Wallet is on {", ".join(wallet_networks)} but payment requires {selected_network}',
                    },
                    indent=2,
                )

            # Check if wallet provider is supported
            if not isinstance(wallet_provider, EvmWalletProvider):
                return json.dumps(
                    {
                        "error": True,
                        "message": "Unsupported wallet provider",
                        "details": "Only EvmWalletProvider is currently supported for x402 payments",
                    },
                    indent=2,
                )

            # Create x402 client with appropriate signer
            client = self._create_x402_client(wallet_provider)

            # Build URL with query params and determine if body is allowed
            final_url = build_url_with_params(url, args.get("query_params"))
            method = args.get("method") or "GET"
            can_have_body = method in ["POST", "PUT", "PATCH"]

            # Build headers, adding Content-Type for JSON body
            headers: dict[str, str] = dict(args.get("headers") or {})
            body = args.get("body")
            if can_have_body and body:
                headers["Content-Type"] = "application/json"

            # Make the request with payment handling
            session = x402_requests(client)
            response = session.request(
                method=method,
                url=final_url,
                headers=headers,
                json=body if can_have_body and body else None,
            )

            data = self._parse_response_data(response)

            # Check for payment proof in headers (v2: payment-response, v1: x-payment-response)
            payment_response_header = response.headers.get(
                "payment-response"
            ) or response.headers.get("x-payment-response")

            payment_proof: dict[str, Any] | None = None
            if payment_response_header:
                try:
                    payment_proof = json.loads(base64.b64decode(payment_response_header))
                except Exception:
                    # If parsing fails, include raw header
                    payment_proof = {"raw": payment_response_header}

            # Get the amount used (supports both v1 and v2 formats)
            amount_used = (
                selected_payment_option.max_amount_required
                or selected_payment_option.amount
                or selected_payment_option.price
            )

            # Check if the response was successful
            # Payment is only settled on 200 status
            if response.status_code != 200:
                return json.dumps(
                    {
                        "status": "error",
                        "message": f"Request failed with status {response.status_code}. Payment was not settled.",
                        "httpStatus": response.status_code,
                        "data": data,
                        "details": {
                            "url": final_url,
                            "method": method,
                        },
                    },
                    indent=2,
                )

            return json.dumps(
                {
                    "status": "success",
                    "data": data,
                    "message": "Request completed successfully with payment",
                    "details": {
                        "url": final_url,
                        "method": method,
                        "paymentUsed": {
                            "network": selected_payment_option.network,
                            "asset": selected_payment_option.asset,
                            "amount": amount_used,
                        },
                        "paymentProof": payment_proof,
                    },
                },
                indent=2,
            )

        except Exception as error:
            return handle_http_error(error, args["url"])

    @create_action(
        name="make_http_request_with_x402",
        description="""
WARNING: This action automatically handles payments without asking for confirmation!
Only use this when explicitly told to skip the confirmation flow.

For most cases, you should:
1. First try make_http_request
2. Then use retry_http_request_with_x402 if payment is required

This action combines both steps into one, which means:
- No chance to review payment details before paying
- No confirmation step
- Automatic payment processing
- Assumes payment option is compatible with wallet network

EXAMPLES:
- Production: make_http_request_with_x402("https://api.example.com/data")
- Local dev: make_http_request_with_x402("http://localhost:3000/protected")

Unless specifically instructed otherwise, prefer the two-step approach with make_http_request first.""",
        schema=DirectX402RequestSchema,
    )
    def make_http_request_with_x402(
        self, wallet_provider: WalletProvider, args: dict[str, Any]
    ) -> str:
        """Make HTTP request with automatic x402 payment handling.

        Args:
            wallet_provider: The wallet provider to use for payment signing.
            args: Request parameters including URL, method, headers, and body.

        Returns:
            str: JSON string containing response data and optional payment proof.

        """
        try:
            url = args["url"]

            # Check if service is registered
            if not is_url_allowed(url, self._registered_services):
                suggestion = (
                    "Use register_x402_service to register this service first."
                    if self._config.allow_dynamic_service_registration
                    else "Dynamic service registration is disabled. Only pre-registered services can be used. Set allow_dynamic_service_registration to True in the agent configuration to enable dynamic service registration."
                )
                return json.dumps(
                    {
                        "error": True,
                        "message": "Service not registered",
                        "details": f'The service URL "{url}" is not registered. Only pre-registered services can be called.',
                        "registeredServices": list(self._registered_services),
                        "suggestion": suggestion,
                    },
                    indent=2,
                )

            if not isinstance(wallet_provider, EvmWalletProvider):
                return json.dumps(
                    {
                        "error": True,
                        "message": "Unsupported wallet provider",
                        "details": "Only EvmWalletProvider is currently supported for x402 payments",
                    },
                    indent=2,
                )

            # Create x402 client with appropriate signer
            client = self._create_x402_client(wallet_provider)

            # Build URL with query params and determine if body is allowed
            final_url = build_url_with_params(url, args.get("query_params"))
            method = args.get("method") or "GET"
            can_have_body = method in ["POST", "PUT", "PATCH"]

            # Build headers, adding Content-Type for JSON body
            headers: dict[str, str] = dict(args.get("headers") or {})
            body = args.get("body")
            if can_have_body and body:
                headers["Content-Type"] = "application/json"

            session = x402_requests(client)
            response = session.request(
                method=method,
                url=final_url,
                headers=headers,
                json=body if can_have_body and body else None,
            )

            data = self._parse_response_data(response)

            # Check for payment proof in headers (v2: payment-response, v1: x-payment-response)
            payment_response_header = response.headers.get(
                "payment-response"
            ) or response.headers.get("x-payment-response")

            payment_proof: dict[str, Any] | None = None
            if payment_response_header:
                try:
                    payment_proof = json.loads(base64.b64decode(payment_response_header))
                except Exception:
                    # If parsing fails, include raw header
                    payment_proof = {"raw": payment_response_header}

            # Check if the response was successful
            # Payment is only settled on 200 status
            if response.status_code != 200:
                return json.dumps(
                    {
                        "success": False,
                        "message": f"Request failed with status {response.status_code}. Payment was not settled.",
                        "url": final_url,
                        "method": method,
                        "status": response.status_code,
                        "data": data,
                    },
                    indent=2,
                )

            return json.dumps(
                {
                    "success": True,
                    "message": "Request completed successfully (payment handled automatically if required)",
                    "url": final_url,
                    "method": method,
                    "status": response.status_code,
                    "data": data,
                    "paymentProof": payment_proof,
                },
                indent=2,
            )

        except Exception as error:
            return handle_http_error(error, args["url"])

    @create_action(
        name="register_x402_service",
        description="""
Registers a service URL for x402 requests. Use this after discovering a service
via discover_x402_services to enable HTTP requests to that service.

NOTE: This action is only available if service discovery is enabled in the agent configuration.
If disabled, services must be pre-registered by the agent administrator.""",
        schema=RegisterServiceSchema,
    )
    def register_service(self, wallet_provider: WalletProvider, args: dict[str, Any]) -> str:
        """Register a service URL for x402 requests.

        Args:
            wallet_provider: The wallet provider (unused but required by interface)
            args: The service URL to register

        Returns:
            str: JSON string confirming registration or error if not allowed

        """
        # Check if service discovery is allowed
        if not self._config.allow_dynamic_service_registration:
            return json.dumps(
                {
                    "error": True,
                    "message": "Dynamic service registration is disabled",
                    "details": "The agent is configured with allow_dynamic_service_registration: False. Services must be pre-registered.",
                },
                indent=2,
            )

        try:
            url = args["url"]

            # Validate URL format
            from urllib.parse import urlparse

            parsed = urlparse(url)
            if not parsed.scheme or not parsed.netloc:
                raise ValueError("Invalid URL format")

            # Add to registered services (full URL for prefix matching)
            self._registered_services.add(url)

            return json.dumps(
                {
                    "success": True,
                    "message": "Service registered successfully",
                    "registeredUrl": url,
                    "totalRegisteredServices": len(self._registered_services),
                },
                indent=2,
            )

        except Exception:
            return json.dumps(
                {
                    "error": True,
                    "message": "Invalid URL format",
                    "details": f'"{args.get("url", "")}" is not a valid URL.',
                },
                indent=2,
            )

    @create_action(
        name="list_registered_services",
        description="""
Lists all service URLs that are currently approved for x402 requests.
These are the only services that can be called using make_http_request or make_http_request_with_x402.""",
        schema=EmptySchema,
    )
    def list_registered_services(
        self, wallet_provider: WalletProvider, args: dict[str, Any]
    ) -> str:
        """List all registered service URLs.

        Args:
            wallet_provider: The wallet provider (unused but required by interface)
            args: Empty arguments object (unused but required by interface)

        Returns:
            str: JSON string containing the list of registered services

        """
        services = list(self._registered_services)

        note = (
            "You can register new services using register_x402_service."
            if self._config.allow_dynamic_service_registration
            else "Dynamic service registration is disabled. Only pre-registered services can be used."
        )

        return json.dumps(
            {
                "success": True,
                "registeredServices": services,
                "count": len(services),
                "allowDynamicServiceRegistration": self._config.allow_dynamic_service_registration,
                "note": note,
            },
            indent=2,
        )

    @create_action(
        name="list_registered_facilitators",
        description="Lists all facilitators that can be used with discover_x402_services.",
        schema=EmptySchema,
    )
    def list_registered_facilitators(
        self, wallet_provider: WalletProvider, args: dict[str, Any]
    ) -> str:
        """List all facilitators (known and custom registered).

        Args:
            wallet_provider: The wallet provider (unused but required by interface)
            args: Empty arguments object (unused but required by interface)

        Returns:
            str: JSON string containing the list of facilitators

        """
        known_facilitators = [
            {"name": name, "url": url, "type": "known"} for name, url in KNOWN_FACILITATORS.items()
        ]

        custom_facilitators = [
            {"name": name, "url": url, "type": "custom"}
            for name, url in self._config.registered_facilitators.items()
        ]

        all_facilitators = known_facilitators + custom_facilitators

        return json.dumps(
            {
                "success": True,
                "facilitators": all_facilitators,
                "knownCount": len(known_facilitators),
                "customCount": len(custom_facilitators),
                "totalCount": len(all_facilitators),
                "note": "Use the 'facilitator' parameter in discover_x402_services to query a specific facilitator by name.",
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
        if network.network_id not in SUPPORTED_NETWORKS:
            return False

        # Check protocol family matches network type
        if network.network_id.startswith("base-"):
            return network.protocol_family == "evm"
        if network.network_id.startswith("solana-"):
            return network.protocol_family == "solana"

        return False

    def _create_x402_client(self, wallet_provider: EvmWalletProvider) -> x402ClientSync:
        """Create an x402 client configured for the given wallet provider.

        Args:
            wallet_provider: The wallet provider to configure the client for

        Returns:
            Configured x402ClientSync

        """
        client = x402ClientSync()
        signer = wallet_provider.to_signer()
        register_exact_evm_client(client, EthAccountSigner(signer))
        return client

    def _parse_response_data(self, response: requests.Response) -> Any:
        """Parse response data based on content type.

        Args:
            response: The requests Response object

        Returns:
            Parsed response data

        """
        content_type = response.headers.get("content-type", "")

        if "application/json" in content_type:
            try:
                return response.json()
            except Exception:
                return response.text

        return response.text


def x402_action_provider(config: X402Config | None = None) -> x402ActionProvider:
    """Create a new x402 action provider.

    Args:
        config: Optional configuration for service registration and payment limits

    Returns:
        x402ActionProvider: A new x402 action provider instance.

    """
    return x402ActionProvider(config)
