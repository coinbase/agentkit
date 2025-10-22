"""Schemas for WOW action provider."""

from pydantic import BaseModel, Field, field_validator

from ...validators.eth import validate_eth_address


class WowBuyTokenSchema(BaseModel):
    """Input schema for buying WOW tokens."""

    contract_address: str = Field(..., description="The WOW token contract address")
    amount_eth_in_wei: str = Field(
        ..., description="Amount of ETH to spend (in wei)", pattern=r"^\d+$"
    )

    @field_validator("contract_address")
    @classmethod
    def validate_address(cls, v: str) -> str:
        """Validate that the contract address is a valid Ethereum address.

        Args:
            v (str): The contract address to validate

        Returns:
            str: The validated contract address

        Raises:
            ValueError: If the address is not a valid Ethereum address

        """
        return validate_eth_address(v)


class WowCreateTokenSchema(BaseModel):
    """Input schema for creating WOW tokens."""

    name: str = Field(..., description="The name of the token to create, e.g. WowCoin")
    symbol: str = Field(..., description="The symbol of the token to create, e.g. WOW")
    token_uri: str | None = Field(
        None, description="The URI of the token metadata to store on IPFS"
    )


class WowSellTokenSchema(BaseModel):
    """Input schema for selling WOW tokens."""

    contract_address: str = Field(..., description="The WOW token contract address")
    amount_tokens_in_wei: str = Field(
        ..., description="Amount of tokens to sell (in wei)", pattern=r"^\d+$"
    )

    @field_validator("contract_address")
    @classmethod
    def validate_address(cls, v: str) -> str:
        """Validate that the contract address is a valid Ethereum address.

        Args:
            v (str): The contract address to validate

        Returns:
            str: The validated contract address

        Raises:
            ValueError: If the address is not a valid Ethereum address

        """
        return validate_eth_address(v)
