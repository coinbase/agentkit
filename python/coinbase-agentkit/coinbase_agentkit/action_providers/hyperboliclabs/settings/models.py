"""Models for Hyperbolic settings services.

This module provides models for interacting with Hyperbolic settings services.
It includes models for wallet linking operations.
"""

from typing import Any, Optional
from pydantic import BaseModel, Field


class WalletLinkRequest(BaseModel):
    """Request model for wallet linking."""
    
    wallet_address: str = Field(
        ...,
        description="The wallet address to link to your Hyperbolic account"
    )


class WalletLinkResponse(BaseModel):
    """Response model for wallet linking API."""
    
    status: str = Field(..., description="Response status")
    message: Optional[str] = Field(None, description="Optional response message")
    wallet_address: Optional[str] = Field(None, description="The linked wallet address")
    
    # Additional fields that might be returned by the API
    address_type: Optional[str] = Field(None, description="Type of the wallet address")
    timestamp: Optional[str] = Field(None, description="Timestamp of wallet linking") 