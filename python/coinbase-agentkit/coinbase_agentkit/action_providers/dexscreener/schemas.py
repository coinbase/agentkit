"""DexScreener action schemas."""

from pydantic import BaseModel, Field


class SearchTokenSchema(BaseModel):
    """Schema for searching tokens on DexScreener."""

    query: str = Field(description="Search query - token name, symbol, or contract address")


class GetTokenPairsSchema(BaseModel):
    """Schema for getting trading pairs for a token."""

    token_address: str = Field(description="The contract address of the token to look up")


class GetPairSchema(BaseModel):
    """Schema for getting details of a specific trading pair."""

    pair_address: str = Field(description="The address of the trading pair")
    chain_id: str = Field(description="The chain ID (e.g., 'base', 'ethereum', 'solana')")


class GetLatestTokensSchema(BaseModel):
    """Schema for getting the latest tokens on a chain."""

    chain_id: str = Field(
        default="base",
        description="The chain ID to search (e.g., 'base', 'ethereum', 'solana')"
    )
