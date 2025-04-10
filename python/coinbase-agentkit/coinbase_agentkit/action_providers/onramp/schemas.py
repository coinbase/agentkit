"""Schemas for Onramp action providers."""

from pydantic import BaseModel


class GetOnrampBuyUrlSchema(BaseModel):
    """Schema for getting an onramp buy URL."""
