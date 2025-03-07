"""Models for Hyperbolic billing services.

This module provides models for interacting with Hyperbolic billing services.
It includes models for balance, purchase history, and instance history.
"""

from typing import Any, List
from pydantic import BaseModel, Field


class Price(BaseModel):
    """Price information."""

    amount: float = Field(..., description="Price amount")
    period: str = Field(..., description="Pricing period (e.g., 'hourly')")
    agent: str | None = Field(None, description="Pricing agent")


class GpuHardware(BaseModel):
    """GPU hardware information."""

    hardware_type: str = Field("gpu", description="Type of hardware")
    model: str = Field(..., description="GPU model name")
    clock_speed: float | None = Field(None, description="GPU clock speed")
    compute_power: float | None = Field(None, description="GPU compute power")
    ram: float | None = Field(None, description="GPU RAM in GB")
    interface: str | None = Field(None, description="GPU interface type")


class CpuHardware(BaseModel):
    """CPU hardware information."""

    hardware_type: str = Field("cpu", description="Type of hardware")
    model: str = Field(..., description="CPU model name")
    cores: int | None = Field(None, description="Number of physical cores")
    virtual_cores: int = Field(..., description="Number of virtual cores")


class StorageHardware(BaseModel):
    """Storage hardware information."""

    hardware_type: str = Field(
        None, description="Type of hardware"
    )  # Can be "storage" or "hardwaretype_unknown"
    capacity: float = Field(..., description="Storage capacity")


class RamHardware(BaseModel):
    """RAM hardware information."""

    hardware_type: str = Field("ram", description="Type of hardware")
    capacity: float = Field(..., description="RAM capacity")


class HardwareInfo(BaseModel):
    """Complete hardware information."""

    cpus: List[CpuHardware] | None = Field(None, description="List of CPU specifications")
    gpus: List[GpuHardware] = Field(..., description="List of GPU specifications")
    storage: List[StorageHardware] | None = Field(
        None, description="List of storage specifications"
    )
    ram: List[RamHardware] | None = Field(None, description="List of RAM specifications")


class InstanceHistoryEntry(BaseModel):
    """Instance history entry."""

    instance_name: str = Field(..., description="Name of the instance")
    started_at: str = Field(..., description="Start time in ISO format")
    terminated_at: str = Field(..., description="Termination time in ISO format")
    price: Price = Field(..., description="Price information")
    hardware: HardwareInfo = Field(..., description="Hardware specifications")
    gpu_count: int = Field(..., description="Number of GPUs")


class InstanceHistoryResponse(BaseModel):
    """Response for instance history."""

    instance_history: List[InstanceHistoryEntry] = Field(
        ..., description="List of instance history entries"
    )


class BillingBalanceResponse(BaseModel):
    """Response model for billing balance API."""

    credits: Any = Field(..., description="Current balance in credits/USD")


class BillingPurchaseHistoryEntry(BaseModel):
    """A single entry in the purchase history."""

    amount: str = Field(..., description="Purchase amount in USD")
    timestamp: str = Field(..., description="ISO format timestamp of the purchase")
    source: str = Field(..., description="Source of the purchase")


class BillingPurchaseHistoryResponse(BaseModel):
    """Response model for billing purchase history API."""

    purchase_history: List[BillingPurchaseHistoryEntry] = Field(
        ..., description="List of purchase history entries"
    ) 