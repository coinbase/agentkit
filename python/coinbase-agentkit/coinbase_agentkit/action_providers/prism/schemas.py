"""Schemas for the Prism Network action provider."""

from pydantic import BaseModel, Field

from .constants import DEFAULT_IMAGE


class WalletSchema(BaseModel):
    """Input schema for the wallet action."""


class ListGpusSchema(BaseModel):
    """Input schema for the list_gpus action."""


class LeaseAndRunSchema(BaseModel):
    """Input schema for the lease_and_run action."""

    command: str = Field(..., description="Command to run on the rented GPU")
    duration_seconds: int = Field(600, description="How long to hold the lease, in seconds")
    min_vram_mib: int = Field(16000, description="Minimum GPU memory in MiB")
    image: str = Field(DEFAULT_IMAGE, description="Digest-pinned container image to boot")
    max_usdg: float = Field(1.0, description="Hard cap on the USDG this lease may cost")


class RunSchema(BaseModel):
    """Input schema for the run action."""

    lease_id: int = Field(..., description="A lease id returned by lease_and_run")
    command: str = Field(..., description="Command to run on the leased GPU")


class EndLeaseSchema(BaseModel):
    """Input schema for the end_lease action."""

    lease_id: int = Field(..., description="A lease id from this session")
