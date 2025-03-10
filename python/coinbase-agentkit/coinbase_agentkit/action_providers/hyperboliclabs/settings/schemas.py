"""Schemas for Hyperbolic Settings action provider."""

from pydantic import BaseModel, Field


class LinkWalletAddressSchema(BaseModel):
    """Input schema for linking a wallet address to your account."""

    address: str = Field(..., description="The wallet address to link to your Hyperbolic account")
