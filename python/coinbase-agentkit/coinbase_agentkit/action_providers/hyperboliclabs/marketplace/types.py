"""Types for Hyperbolic marketplace operations.

This module provides type definitions for marketplace API communication.
"""

from typing import Any

from pydantic import BaseModel, Field


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

    hardware_type: str = Field(None, description="Type of hardware")
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


class NestedGpuHardware(BaseModel):
    """GPU hardware information for nested instances."""

    hardware_type: str = Field("gpu", description="Type of hardware")
    model: str = Field(..., description="GPU model name")
    ram: float | None = Field(None, description="GPU RAM in GB")


class NestedStorageHardware(BaseModel):
    """Storage hardware information for nested instances."""

    hardware_type: str = Field(None, description="Type of hardware")
    capacity: float = Field(..., description="Storage capacity")


class NestedHardwareComponent(BaseModel):
    """A single hardware component in the nested structure."""

    gpu: NestedGpuHardware | None = Field(None, description="GPU hardware if present")
    storage: NestedStorageHardware | None = Field(None, description="Storage hardware if present")


class Location(BaseModel):
    """Location information."""

    region: str | None = Field(None, description="Geographic region")


class Price(BaseModel):
    """Price information."""

    amount: float = Field(..., description="Price amount")
    period: str = Field(..., description="Pricing period (e.g., 'hourly')")
    agent: str | None = Field(None, description="Pricing agent")


class PricingInfo(BaseModel):
    """Pricing information for an instance."""

    price: Price = Field(..., description="Price details")


class NestedInstance(BaseModel):
    """Instance information in nested format."""

    id: str = Field(..., description="Instance identifier")
    status: str = Field(..., description="Instance status")
    hardware: list[NestedHardwareComponent] = Field(..., description="List of hardware components")


class NodeInstance(BaseModel):
    """Top-level node information."""

    id: str = Field(..., description="Instance identifier")
    status: str = Field(..., description="Instance status")
    hardware: HardwareInfo = Field(..., description="Hardware specifications")
    location: Location | None = Field(None, description="Location information")
    instances: list[NestedInstance] = Field(
        default_factory=list, description="List of nested instances"
    )
    network: dict[str, Any] = Field(default_factory=dict, description="Network configuration")
    gpus_total: int | None = Field(None, description="Total number of GPUs")
    gpus_reserved: int | None = Field(None, description="Number of reserved GPUs")
    has_persistent_storage: bool | None = Field(
        None, description="Whether persistent storage is available"
    )
    supplier_id: str | None = Field(None, description="Supplier identifier")
    pricing: PricingInfo | None = Field(None, description="Pricing information")
    reserved: bool | None = Field(None, description="Whether the instance is reserved")
    cluster_name: str | None = Field(None, description="Cluster name")
    owner: str | None = Field(None, description="Owner identifier")
    gpu_count: int | None = Field(None, description="Number of GPUs allocated")


class AvailableInstance(NodeInstance):
    """Available instance information."""

    pass


class AvailableInstancesResponse(BaseModel):
    """Response for available instances."""

    instances: list[AvailableInstance] = Field(..., description="List of available instances")


class SSHAccess(BaseModel):
    """SSH access information for connecting to a remote instance."""

    host: str = Field(..., description="SSH host address")
    username: str = Field(..., description="SSH username")
    key_path: str | None = Field("~/.ssh/id_rsa", description="Path to SSH key file")
    ssh_command: str | None = Field(None, description="Full SSH command if provided")


class NodeRental(BaseModel):
    """Record of a rented compute node."""

    id: str = Field(..., description="Instance identifier")
    start: str | None = Field(None, description="Start time of the rental")
    end: str | None = Field(None, description="End time of the rental")
    instance: NodeInstance = Field(..., description="Full node details")
    ssh_command: str | None = Field(
        None, description="SSH command to access the node", alias="sshCommand"
    )
    ssh_access: SSHAccess | None = Field(None, description="SSH access details")

    model_config = {"populate_by_name": True}

    @property
    def status(self) -> str:
        """Get the node status from the nested instance."""
        return self.instance.status


class InstanceHistoryEntry(BaseModel):
    """Instance history entry."""

    instance_name: str = Field(..., description="Name of the instance")
    started_at: str | None = Field(None, description="Start time in ISO format")
    terminated_at: str | None = Field(None, description="Termination time in ISO format")
    price: Price = Field(..., description="Price information")
    hardware: HardwareInfo = Field(..., description="Hardware specifications")
    gpu_count: int = Field(..., description="Number of GPUs")


class InstanceHistoryResponse(BaseModel):
    """Response for instance history."""

    instance_history: list[InstanceHistoryEntry] = Field(
        ..., description="List of instance history entries"
    )


class TerminateInstanceRequest(BaseModel):
    """Request to terminate an instance."""

    id: str = Field(..., description="ID of the instance to terminate")


class TerminateInstanceResponse(BaseModel):
    """Response from terminate instance API endpoint."""

    status: str | None = Field(None, description="Response status")
    message: str | None = Field(None, description="Optional response message")
    error_code: int | None = Field(None, description="Error code for failed operations")

    @property
    def get_status(self) -> str:
        """Return status string based on fields for backward compatibility."""
        if self.status == "success" or self.status == "status":
            return "success"
        if self.error_code is not None:
            return f"error_{self.error_code}"
        if self.status is not None:
            return self.status
        return "error"


class ContainerImage(BaseModel):
    """Container image configuration."""

    name: str = Field(..., description="Name of the container image")
    tag: str = Field(..., description="Tag of the container image")
    port: int = Field(..., description="Port to expose")


class RentInstanceRequest(BaseModel):
    """Request to rent an instance."""

    cluster_name: str = Field(..., description="Name of the cluster to create instance in")
    node_name: str = Field(..., description="Name of the node")
    gpu_count: int = Field(..., description="Number of GPUs to allocate")
    image: ContainerImage | None = Field(None, description="Optional container configuration")


class RentInstanceResponse(BaseModel):
    """Response from rent instance API endpoint."""

    status: str = Field(..., description="Response status")
    instance_name: str | None = Field(None, description="Instance name (e.g. 'actual-bonsai-frog')")


class RentedInstancesResponse(BaseModel):
    """Response for rented instances."""

    instances: list[NodeRental] = Field(..., description="List of rented nodes")
