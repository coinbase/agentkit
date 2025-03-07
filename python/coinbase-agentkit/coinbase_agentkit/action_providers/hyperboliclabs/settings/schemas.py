"""Schemas for Hyperbolic Settings action provider."""

from pydantic import BaseModel, Field


class LinkWalletAddressSchema(BaseModel):
    """Input schema for linking a wallet address to your account."""
    
    wallet_address: str = Field(
        ...,  # ... means the field is required
        description="The wallet address to link to your Hyperbolic account"
    ) 