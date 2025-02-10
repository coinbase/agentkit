"""Input schemas for WOW action provider."""
from pydantic import BaseModel, Field, field_validator

from ...validators.eth import validate_eth_address


class WowBuyTokenInput(BaseModel):
    """Input schema for buying WOW tokens."""
    contract_address: str = Field(
        ..., 
        description="The WOW token contract address"
    )
    amount_eth_in_wei: str = Field(
        ..., 
        description="Amount of ETH to spend (in wei)",
        pattern=r"^\d+$"
    )

    @field_validator("contract_address")
    def validate_address(v: str) -> str:
        return validate_eth_address(v)


class WowCreateTokenInput(BaseModel):
    """Input schema for creating WOW tokens."""
    name: str = Field(..., description="The name of the token to create, e.g. WowCoin")
    symbol: str = Field(..., description="The symbol of the token to create, e.g. WOW")
    token_uri: str | None = Field(
        None,
        description="The URI of the token metadata to store on IPFS"
    )


class WowSellTokenInput(BaseModel):
    """Input schema for selling WOW tokens."""
    contract_address: str = Field(
        ..., 
        description="The WOW token contract address"
    )
    amount_tokens_in_wei: str = Field(
        ...,
        description="Amount of tokens to sell (in wei)",
        pattern=r"^\d+$"
    )

    @field_validator("contract_address")
    def validate_address(v: str) -> str:
        return validate_eth_address(v)
