"""Schemas for the Spraay action provider."""

import re
from dataclasses import dataclass, field

from pydantic import BaseModel, Field, field_validator

from .constants import SPRAAY_GATEWAY_BASE_URL, SPRAAY_MAX_RECIPIENTS

EVM_ADDRESS_PATTERN = re.compile(r"^0x[a-fA-F0-9]{40}$")
DECIMAL_AMOUNT_PATTERN = re.compile(r"^\d+(\.\d+)?$")


@dataclass
class SpraayConfig:
    """Configuration options for SpraayActionProvider."""

    # Maximum x402 payment per gateway request, in USDC whole units.
    # Default: 1.0 (or SPRAAY_MAX_GATEWAY_PAYMENT_USDC env var).
    max_gateway_payment_usdc: float = 1.0

    # Optional pre-funded x402 payment header. When set, gateway requests send
    # this value in the X-PAYMENT header instead of signing a payment with the
    # wallet provider. Useful when payments are settled out-of-band.
    x402_payment_header: str | None = None

    # Override for the Spraay gateway base URL. Defaults to the production
    # gateway; intended for testing and staging environments.
    gateway_base_url: str = field(default=SPRAAY_GATEWAY_BASE_URL)


def _validate_addresses(addresses: list[str]) -> list[str]:
    """Validate address format and reject case-insensitive duplicates.

    Args:
        addresses: The recipient addresses to validate.

    Returns:
        list[str]: The validated addresses.

    Raises:
        ValueError: If an address is malformed or duplicated.

    """
    seen: set[str] = set()
    for address in addresses:
        if not EVM_ADDRESS_PATTERN.match(address):
            raise ValueError(f"Invalid Ethereum address: {address}")
        normalized = address.lower()
        if normalized in seen:
            raise ValueError(f"Duplicate recipient address: {address}")
        seen.add(normalized)
    return addresses


def _validate_amount(value: str) -> str:
    """Validate that an amount is a positive decimal number string.

    Args:
        value: The amount string to validate.

    Returns:
        str: The validated amount.

    Raises:
        ValueError: If the amount is malformed or not positive.

    """
    if not DECIMAL_AMOUNT_PATTERN.match(value):
        raise ValueError(f"Amount must be a positive decimal number string, got: {value}")
    if float(value) <= 0:
        raise ValueError(f"Amount must be greater than zero, got: {value}")
    return value


class SprayEthInput(BaseModel):
    """Input schema for spraying ETH to multiple recipients."""

    recipients: list[str] = Field(
        ...,
        description="Array of recipient wallet addresses (e.g. ['0xABC...', '0xDEF...'])",
        min_length=1,
        max_length=SPRAAY_MAX_RECIPIENTS,
    )
    amount_per_recipient: str = Field(
        ...,
        description="Amount of ETH to send to each recipient in whole units (e.g. '0.01')",
    )
    preflight: bool = Field(
        default=False,
        description=(
            "When true, validate the batch against the free Spraay gateway pre-flight "
            "endpoint before signing. Gateway unavailability never blocks the on-chain path."
        ),
    )

    @field_validator("recipients")
    @classmethod
    def validate_recipients(cls, v: list[str]) -> list[str]:
        """Validate recipient addresses and reject duplicates."""
        return _validate_addresses(v)

    @field_validator("amount_per_recipient")
    @classmethod
    def validate_amount(cls, v: str) -> str:
        """Validate the per-recipient amount."""
        return _validate_amount(v)


class SprayTokenInput(SprayEthInput):
    """Input schema for spraying ERC-20 tokens to multiple recipients."""

    token_address: str = Field(..., description="The ERC-20 token contract address")
    amount_per_recipient: str = Field(
        ...,
        description="Amount of tokens to send to each recipient in whole units (e.g. '100')",
    )

    @field_validator("token_address")
    @classmethod
    def validate_token_address(cls, v: str) -> str:
        """Validate the token contract address format."""
        if not EVM_ADDRESS_PATTERN.match(v):
            raise ValueError(f"Invalid token contract address: {v}")
        return v


class SprayEthVariableInput(BaseModel):
    """Input schema for spraying variable ETH amounts to multiple recipients."""

    recipients: list[str] = Field(
        ...,
        description="Array of recipient wallet addresses",
        min_length=1,
        max_length=SPRAAY_MAX_RECIPIENTS,
    )
    amounts: list[str] = Field(
        ...,
        description="Array of ETH amounts corresponding to each recipient (e.g. ['0.01', '0.05'])",
        min_length=1,
    )
    preflight: bool = Field(
        default=False,
        description=(
            "When true, validate the batch against the free Spraay gateway pre-flight "
            "endpoint before signing. Gateway unavailability never blocks the on-chain path."
        ),
    )

    @field_validator("recipients")
    @classmethod
    def validate_recipients(cls, v: list[str]) -> list[str]:
        """Validate recipient addresses and reject duplicates."""
        return _validate_addresses(v)

    @field_validator("amounts")
    @classmethod
    def validate_amounts(cls, v: list[str]) -> list[str]:
        """Validate every per-recipient amount."""
        return [_validate_amount(a) for a in v]


class SprayTokenVariableInput(SprayEthVariableInput):
    """Input schema for spraying variable token amounts to multiple recipients."""

    token_address: str = Field(..., description="The ERC-20 token contract address")
    amounts: list[str] = Field(
        ...,
        description="Array of token amounts corresponding to each recipient (e.g. ['100', '50'])",
        min_length=1,
    )

    @field_validator("token_address")
    @classmethod
    def validate_token_address(cls, v: str) -> str:
        """Validate the token contract address format."""
        if not EVM_ADDRESS_PATTERN.match(v):
            raise ValueError(f"Invalid token contract address: {v}")
        return v


class BatchRecipient(BaseModel):
    """A single (recipient, amount) entry in a gateway batch."""

    recipient: str = Field(..., description="Recipient wallet address")
    amount: str = Field(
        ..., description="Amount for this recipient, in whole token units (e.g. '1.00')"
    )

    @field_validator("recipient")
    @classmethod
    def validate_recipient(cls, v: str) -> str:
        """Validate the recipient address format."""
        if not EVM_ADDRESS_PATTERN.match(v):
            raise ValueError(f"Invalid Ethereum address: {v}")
        return v

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: str) -> str:
        """Validate the recipient amount."""
        return _validate_amount(v)


def _validate_batch_recipients(entries: list[BatchRecipient]) -> list[BatchRecipient]:
    """Reject case-insensitive duplicate recipients in a gateway batch.

    Args:
        entries: The batch entries to validate.

    Returns:
        list[BatchRecipient]: The validated entries.

    """
    _validate_addresses([entry.recipient for entry in entries])
    return entries


class SpraayValidateBatchInput(BaseModel):
    """Input schema for validating a batch via the free Spraay gateway endpoint."""

    token: str = Field(..., description="Token symbol for the batch (e.g. 'USDC' or 'ETH')")
    recipients: list[BatchRecipient] = Field(
        ...,
        description="Batch entries as (recipient, amount) pairs",
        min_length=1,
        max_length=SPRAAY_MAX_RECIPIENTS,
    )
    chain: str = Field(default="base", description="Target chain identifier (default 'base')")

    @field_validator("recipients")
    @classmethod
    def validate_recipients(cls, v: list[BatchRecipient]) -> list[BatchRecipient]:
        """Reject duplicate recipients."""
        return _validate_batch_recipients(v)


class SpraayEstimateBatchInput(BaseModel):
    """Input schema for estimating batch cost via the free Spraay gateway endpoint."""

    recipients: int = Field(
        ...,
        description="Number of recipients in the batch (positive integer count)",
        gt=0,
        le=SPRAAY_MAX_RECIPIENTS,
    )
    token: str = Field(..., description="Token symbol for the batch (e.g. 'USDC' or 'ETH')")
    chain: str = Field(default="base", description="Target chain identifier (default 'base')")


class SpraayExecuteBatchGatewayInput(SpraayValidateBatchInput):
    """Input schema for executing a batch through the x402-metered Spraay gateway."""


class SpraayCreateEscrowInput(BaseModel):
    """Input schema for creating an escrow via the x402-metered Spraay gateway."""

    token: str = Field(..., description="Token symbol for the escrow (e.g. 'USDC')")
    amount: str = Field(..., description="Escrow amount, in whole token units (e.g. '250.00')")
    beneficiary: str = Field(
        ..., description="Wallet address that can receive the escrowed funds on release"
    )
    chain: str = Field(default="base", description="Target chain identifier (default 'base')")
    deadline: str | None = Field(
        default=None,
        description="Optional ISO-8601 timestamp after which the escrow can be refunded",
    )
    description: str | None = Field(
        default=None,
        max_length=500,
        description="Optional human-readable description of the escrow terms",
    )

    @field_validator("beneficiary")
    @classmethod
    def validate_beneficiary(cls, v: str) -> str:
        """Validate the beneficiary address format."""
        if not EVM_ADDRESS_PATTERN.match(v):
            raise ValueError(f"Invalid Ethereum address: {v}")
        return v

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: str) -> str:
        """Validate the escrow amount."""
        return _validate_amount(v)


__all__ = [
    "SpraayConfig",
    "SprayEthInput",
    "SprayTokenInput",
    "SprayEthVariableInput",
    "SprayTokenVariableInput",
    "BatchRecipient",
    "SpraayValidateBatchInput",
    "SpraayEstimateBatchInput",
    "SpraayExecuteBatchGatewayInput",
    "SpraayCreateEscrowInput",
    "SPRAAY_GATEWAY_BASE_URL",
]
