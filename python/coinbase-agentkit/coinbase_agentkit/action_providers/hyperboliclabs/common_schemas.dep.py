"""Common schemas and models for Hyperbolic action providers.

This module contains schemas and models that are shared across multiple Hyperbolic action providers.
"""

from pydantic import BaseModel, Field

# Common constants
SUPPORTED_MESSAGE_ROLES = ["system", "assistant", "user"]
SUPPORTED_AUDIO_LANGUAGES = ["EN", "ES", "FR", "ZH", "JP", "KR"]
SUPPORTED_AUDIO_SPEAKERS = {
    "EN": ["EN-US", "EN-GB"],
    "ES": ["ES-ES"],
    "FR": ["FR-FR"],
    "ZH": ["ZH-CN"],
    "JP": ["JP-JP"],
    "KR": ["KR-KR"],
}
SUPPORTED_IMAGE_MODELS = [
    "SDXL1.0-base",
    "SD1.5",
    "SDXL-ControlNet",
    "SD1.5-ControlNet",
]

# Common models
class ChatMessage(BaseModel):
    """A single message in a chat conversation."""

    role: str = Field(..., description="The role of the message sender")
    content: str = Field(..., description="The content of the message")


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

    cpus: list[CpuHardware] | None = Field(None, description="List of CPU specifications")
    gpus: list[GpuHardware] = Field(..., description="List of GPU specifications")
    storage: list[StorageHardware] | None = Field(
        None, description="List of storage specifications"
    )
    ram: list[RamHardware] | None = Field(None, description="List of RAM specifications") 