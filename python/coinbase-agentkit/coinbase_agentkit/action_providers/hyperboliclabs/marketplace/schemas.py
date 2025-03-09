"""Schemas for Hyperbolic marketplace actions."""

from pydantic import BaseModel, Field


class GetAvailableGpusSchema(BaseModel):
    """Schema for get_available_gpus action."""

    pass


class GetGpuStatusSchema(BaseModel):
    """Schema for get_gpu_status action."""

    pass


class RemoteShellSchema(BaseModel):
    """Schema for remote_shell action."""

    command: str = Field(
        description="The shell command to execute on the remote server",
        min_length=1,
    )


class RentComputeSchema(BaseModel):
    """Schema for rent_compute action."""

    cluster_name: str = Field(description="The cluster to rent from")
    node_name: str = Field(description="The node ID to rent")
    gpu_count: str = Field(description="Number of GPUs to rent")


class SSHAccessSchema(BaseModel):
    """Schema for ssh_connect action."""

    host: str = Field(description="Remote server hostname/IP")
    username: str = Field(description="SSH username")
    password: str | None = Field(None, description="Optional SSH password")
    private_key_path: str | None = Field(None, description="Optional path to private key file")
    port: int = Field(22, description="SSH port number")


class TerminateComputeSchema(BaseModel):
    """Schema for terminate_compute action."""

    instance_id: str = Field(description="The ID of the instance to terminate")
