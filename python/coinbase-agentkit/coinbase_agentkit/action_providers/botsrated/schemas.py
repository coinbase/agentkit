"""Schemas for the BotsRated action provider."""

from pydantic import BaseModel, Field


class PreflightSchema(BaseModel):
    """Input schema for a free BotsRated preflight lookup."""

    url: str = Field(
        ...,
        description=(
            "The x402 seller or MCP server to look up, as a host (e.g. api.example.com) "
            "or a full URL (e.g. https://api.example.com/v1/data)"
        ),
    )
    pay_to: str | None = Field(
        default=None,
        description=(
            "Optional payTo address from the x402 payment option the agent is about to pay, "
            "compared against the payTo BotsRated observed"
        ),
    )
    network: str | None = Field(
        default=None,
        description="Optional CAIP-2 network of that payment option, e.g. eip155:8453 for Base",
    )


class CheckHostSchema(BaseModel):
    """Input schema for a BotsRated check of one host."""

    host: str = Field(
        ...,
        description="The x402 seller or MCP server host to check, e.g. api.example.com",
    )


class FindServicesSchema(BaseModel):
    """Input schema for finding paid AI-agent services by need."""

    query: str = Field(
        ...,
        description="What the agent needs, in a few keywords, e.g. 'weather forecast'",
    )
    limit: int = Field(
        default=5,
        ge=1,
        le=10,
        description="Maximum number of results per type (x402 sellers and MCP servers), 1-10",
    )
