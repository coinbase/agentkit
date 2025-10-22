"""Schemas for x402 action providers."""

from typing import Any, Literal

from pydantic import BaseModel, Field


class HttpRequestSchema(BaseModel):
    """Schema for making basic HTTP requests."""

    url: str = Field(
        ..., description="The URL of the API endpoint (can be localhost for development)"
    )
    method: Literal["GET", "POST", "PUT", "DELETE", "PATCH"] = Field(
        default="GET", description="The HTTP method to use for the request"
    )
    headers: dict[str, str] | None = Field(
        default=None, description="Optional headers to include in the request"
    )
    body: Any | None = Field(
        default=None, description="Optional request body for POST/PUT/PATCH requests"
    )

    class Config:
        """Pydantic config."""

        title = "Instructions for making a basic HTTP request"


class RetryWithX402Schema(BaseModel):
    """Schema for retrying requests with x402 payment."""

    url: str = Field(
        ..., description="The URL of the API endpoint (can be localhost for development)"
    )
    method: Literal["GET", "POST", "PUT", "DELETE", "PATCH"] = Field(
        default="GET", description="The HTTP method to use for the request"
    )
    headers: dict[str, str] | None = Field(
        default=None, description="Optional headers to include in the request"
    )
    body: Any | None = Field(
        default=None, description="Optional request body for POST/PUT/PATCH requests"
    )
    scheme: str = Field(..., description="The payment scheme to use")
    network: str = Field(..., description="The network to use for payment")
    max_amount_required: str = Field(..., description="The maximum amount required for payment")
    resource: str = Field(..., description="The resource URL that requires payment")
    description: str = Field(default="", description="Description of the payment requirement")
    mime_type: str = Field(default="", description="MIME type of the response")
    output_schema: dict[str, Any] | None = Field(
        default=None, description="Schema of the expected output"
    )
    pay_to: str = Field(..., description="Address to send payment to")
    max_timeout_seconds: int = Field(..., description="Maximum timeout in seconds")
    asset: str = Field(..., description="Asset contract address to use for payment")
    extra: dict[str, Any] | None = Field(default=None, description="Additional payment metadata")

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
    method: Literal["GET", "POST", "PUT", "DELETE", "PATCH"] = Field(
        default="GET", description="The HTTP method to use for the request"
    )
    headers: dict[str, str] | None = Field(
        default=None, description="Optional headers to include in the request"
    )
    body: Any | None = Field(
        default=None, description="Optional request body for POST/PUT/PATCH requests"
    )

    class Config:
        """Pydantic config."""

        title = "Instructions for making an HTTP request with automatic x402 payment handling. WARNING: This bypasses user confirmation - only use when explicitly told to skip confirmation!"
