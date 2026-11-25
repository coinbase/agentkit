"""Schemas for Hyperlane action provider."""

from pydantic import BaseModel, Field


class HyperlaneTransferRemoteSchema(BaseModel):
    """Input schema for sending a Warp Route token transfer to another chain."""

    warp_route_address: str = Field(
        ...,
        description="Address of the Hyperlane Warp Route (TokenRouter) on the current chain.",
    )
    destination: str = Field(
        ...,
        description=(
            "Destination chain name (e.g. `ethereum`, `optimism`, `arbitrum`, `base`, "
            "`polygon`, `bsc`). Resolved to a Hyperlane domain ID."
        ),
    )
    recipient: str = Field(
        ...,
        description="Recipient EVM address on the destination chain.",
    )
    amount: str = Field(
        ...,
        description="Amount to send in human-readable units, e.g. `100` USDC, `0.5` WETH.",
    )
    token_address: str = Field(
        ...,
        description=(
            "Address of the underlying ERC-20 token on the current chain. Used to fetch "
            "decimals and to approve the Warp Route to spend tokens before transfer."
        ),
    )


class HyperlaneQuoteGasSchema(BaseModel):
    """Input schema for previewing the interchain gas payment for a Warp Route transfer."""

    warp_route_address: str = Field(
        ...,
        description="Address of the Hyperlane Warp Route (TokenRouter) on the current chain.",
    )
    destination: str = Field(
        ...,
        description=(
            "Destination chain name (e.g. `ethereum`, `optimism`, `arbitrum`, `base`, "
            "`polygon`, `bsc`)."
        ),
    )
