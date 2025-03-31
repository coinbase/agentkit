"""Schemas for Onramp action providers."""

from enum import Enum

from pydantic import BaseModel, Field


class CryptoAsset(str, Enum):
    """Supported cryptocurrency assets."""

    ETH = "ETH"
    USDC = "USDC"


class GetOnrampBuyUrlSchema(BaseModel):
    """Schema for getting an onramp buy URL."""

    asset: CryptoAsset = Field(
        default=CryptoAsset.ETH,
        description="The cryptocurrency to purchase. Use this when you need to buy more funds to complete transactions.",
    )
