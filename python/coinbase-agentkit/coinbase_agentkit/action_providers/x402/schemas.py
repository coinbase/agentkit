"""Schemas for x402 action providers."""

from dataclasses import dataclass, field
from typing import Any, Literal

from pydantic import BaseModel, Field

from .constants import DEFAULT_FACILITATOR


@dataclass
class X402Config:
    """Configuration options for X402ActionProvider."""

    # Service URLs the agent can call. Only these services will be allowed for HTTP requests.
    registered_services: list[str] = field(default_factory=list)

    # Allow agent to register services discovered from bazaar at runtime.
    # Default: False (or X402_ALLOW_DYNAMIC_SERVICE_REGISTRATION="true" env var)
    allow_dynamic_service_registration: bool = False

    # Additional facilitators beyond the defaults (CDP, PayAI, Dexter).
    # Map of name -> URL. Names can be used with discover_x402_services action.
    # Example: {"myFacilitator": "https://my-facilitator.com"}
    registered_facilitators: dict[str, str] = field(default_factory=dict)

    # Maximum payment per request in USDC whole units.
    # Default: 1.0 (or X402_MAX_PAYMENT_USDC env var)
    max_payment_usdc: float = 1.0


class EmptySchema(BaseModel):
    """Schema for listing registered services/facilitators (no parameters required)."""

    class Config:
        """Pydantic config."""

        title = "No parameters required"


class RegisterServiceSchema(BaseModel):
    """Schema for registering a service URL for x402 requests."""

    url: str = Field(..., description="Service URL to register for x402 requests")

    class Config:
        """Pydantic config."""

        title = "Parameters for registering a service URL for x402 requests"


class ListX402ServicesSchema(BaseModel):
    """Schema for listing x402 services."""

    facilitator: str = Field(
        default=DEFAULT_FACILITATOR,
        description="Facilitator to query: 'cdp' (Coinbase CDP), 'payai' (PayAI), 'dexter' (Dexter) or a registered custom facilitator name.",
    )
    max_usdc_price: float = Field(
        default=1.0,
        ge=0,
        description="Maximum price in USDC whole units (e.g., 0.1 for 0.10 USDC). Only USDC payment options will be considered. Defaults to 1.0 USDC.",
    )
    x402_versions: list[int] = Field(
        default=[1, 2],
        description="Filter by x402 protocol version (1 or 2). Defaults to accepting both versions.",
    )
    keyword: str | None = Field(
        default=None,
        description="Optional keyword to filter services by description (case-insensitive). Example: 'weather' to find weather-related services.",
    )

    class Config:
        """Pydantic config."""

        title = "Parameters for listing x402 services with optional filtering"


class HttpRequestSchema(BaseModel):
    """Schema for making basic HTTP requests."""

    url: str = Field(
        ..., description="The URL of the API endpoint (can be localhost for development)"
    )
    method: Literal["GET", "POST", "PUT", "DELETE", "PATCH"] | None = Field(
        default="GET", description="The HTTP method to use for the request"
    )
    headers: dict[str, str] | None = Field(
        default=None, description="Optional headers to include in the request"
    )
    query_params: dict[str, str] | None = Field(
        default=None,
        description=(
            "Query parameters to append to the URL as key-value string pairs. "
            "Use ONLY for GET/DELETE requests. "
            "For POST/PUT/PATCH, you must use the 'body' parameter instead. "
            "Example: {'location': 'NYC', 'units': 'metric'} becomes ?location=NYC&units=metric"
        ),
    )
    body: Any | None = Field(
        default=None,
        description=(
            "Request body - REQUIRED for POST/PUT/PATCH requests when sending data. "
            "Always prefer 'body' over 'query_params' for POST/PUT/PATCH. "
            "Do NOT use for GET or DELETE, use query_params instead."
        ),
    )

    class Config:
        """Pydantic config."""

        title = "Instructions for making a basic HTTP request"


class PaymentOptionSchema(BaseModel):
    """Payment option schema that supports both v1 and v2 formats."""

    scheme: str = Field(..., description="Payment scheme (e.g., 'exact')")
    network: str = Field(
        ...,
        description="Network identifier (v1: 'base-sepolia' or v2 CAIP-2: 'eip155:84532')",
    )
    asset: str = Field(..., description="Asset address or identifier")
    # v1 format
    max_amount_required: str | None = Field(
        default=None, description="Maximum amount required (v1 format)"
    )
    # v2 format
    amount: str | None = Field(default=None, description="Amount required (v2 format)")
    price: str | None = Field(default=None, description="Price (v2 format, e.g., '$0.01')")
    pay_to: str | None = Field(default=None, description="Payment recipient address (v2 format)")

    class Config:
        """Pydantic config."""

        title = "Payment option supporting both v1 and v2 x402 formats"


class RetryWithX402Schema(BaseModel):
    """Schema for retrying requests with x402 payment."""

    url: str = Field(
        ..., description="The URL of the API endpoint (can be localhost for development)"
    )
    method: Literal["GET", "POST", "PUT", "DELETE", "PATCH"] | None = Field(
        default="GET", description="The HTTP method to use for the request"
    )
    headers: dict[str, str] | None = Field(
        default=None, description="Optional headers to include in the request"
    )
    query_params: dict[str, str] | None = Field(
        default=None,
        description=(
            "Query parameters to append to the URL as key-value string pairs. "
            "Use ONLY for GET/DELETE requests. "
            "For POST/PUT/PATCH, you must use the 'body' parameter instead. "
            "Example: {'location': 'NYC', 'units': 'metric'} becomes ?location=NYC&units=metric"
        ),
    )
    body: Any | None = Field(
        default=None,
        description=(
            "Request body - REQUIRED for POST/PUT/PATCH requests when sending data. "
            "Always prefer 'body' over 'query_params' for POST/PUT/PATCH. "
            "Do NOT use for GET or DELETE, use query_params instead."
        ),
    )
    selected_payment_option: PaymentOptionSchema = Field(
        ...,
        description="The EXACT payment option from acceptablePaymentOptions. Pass the object as-is without modifying any values. The 'amount' field is in atomic units.",
    )

    class Config:
        """Pydantic config."""

        title = (
            "Instructions for retrying a request with x402 payment after receiving a 402 response"
        )


class DirectX402RequestSchema(BaseModel):
    """Schema for direct x402 payment requests."""

    url: str = Field(
        ..., description="The URL of the API endpoint (can be localhost for development)"
    )
    method: Literal["GET", "POST", "PUT", "DELETE", "PATCH"] | None = Field(
        default="GET", description="The HTTP method to use for the request"
    )
    headers: dict[str, str] | None = Field(
        default=None, description="Optional headers to include in the request"
    )
    query_params: dict[str, str] | None = Field(
        default=None,
        description=(
            "Query parameters to append to the URL as key-value string pairs. "
            "Use ONLY for GET/DELETE requests. "
            "For POST/PUT/PATCH, use the 'body' parameter instead. "
            "Example: {'location': 'NYC', 'units': 'metric'} becomes ?location=NYC&units=metric"
        ),
    )
    body: Any | None = Field(
        default=None,
        description=(
            "Request body - REQUIRED for POST/PUT/PATCH requests when sending data. "
            "Always prefer 'body' over 'query_params' for POST/PUT/PATCH. "
            "Do NOT use for GET or DELETE, use query_params instead."
        ),
    )

    class Config:
        """Pydantic config."""

        title = (
            "Instructions for making an HTTP request with automatic x402 payment handling. "
            "WARNING: This bypasses user confirmation - only use when explicitly told to skip confirmation!"
        )
