"""Schemas for Hyperbolic marketplace actions."""

from pydantic import BaseModel, Field


class GetAvailableGpusSchema(BaseModel):
    """Schema for get_available_gpus action."""

    pass


class GetAvailableGpusByTypeSchema(BaseModel):
    """Schema for get_available_gpus_by_type action."""

    gpu_model: str = Field(description="The GPU model to filter by (e.g., 'NVIDIA A100')")


class GetAvailableGpusTypesSchema(BaseModel):
    """Schema for get_available_gpus_types action."""

    pass


class GetGpuStatusSchema(BaseModel):
    """Schema for get_gpu_status action."""

    pass


class RentComputeSchema(BaseModel):
    """Schema for rent_compute action."""

    cluster_name: str = Field(description="The cluster to rent from")
    node_name: str = Field(description="The node ID to rent")
    gpu_count: str = Field(description="Number of GPUs to rent")


class TerminateComputeSchema(BaseModel):
    """Schema for terminate_compute action."""

    id: str = Field(description="The ID of the instance to terminate")
