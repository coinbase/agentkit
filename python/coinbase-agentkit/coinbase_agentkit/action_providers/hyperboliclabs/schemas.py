"""Schemas for Hyperbolic action provider."""

from pydantic import BaseModel, Field


class GetAvailableGpusSchema(BaseModel):
    """Input schema for getting available GPU machines."""

    pass


class GetCurrentBalanceSchema(BaseModel):
    """Input schema for getting current balance and purchase history."""

    pass


class GetGpuStatusSchema(BaseModel):
    """Input schema for getting status of rented GPUs."""

    pass


class GetSpendHistorySchema(BaseModel):
    """Input schema for getting GPU rental spending history."""

    pass


class LinkWalletAddressSchema(BaseModel):
    """Input schema for linking a wallet address to your account."""

    wallet_address: str = Field(
        ...,
        description="The wallet address to link to your Hyperbolic account",
        min_length=1,
    )


class RemoteShellSchema(BaseModel):
    """Input schema for executing remote shell commands."""

    command: str = Field(
        ...,
        description="The shell command to execute on the remote server",
        min_length=1,
    )


class RentComputeSchema(BaseModel):
    """Input schema for renting GPU compute resources."""

    cluster_name: str = Field(
        ...,
        description="The cluster name that the user wants to rent from",
    )
    node_name: str = Field(
        ...,
        description="The node ID that the user wants to rent",
    )
    gpu_count: str = Field(
        ...,
        description="The amount of GPUs that the user wants to rent from the node",
    )


class SSHAccessSchema(BaseModel):
    """Input schema for SSH access to remote servers."""

    host: str = Field(
        ...,
        description="Hostname or IP address of the remote server",
    )
    username: str = Field(
        ...,
        description="SSH username for authentication",
    )
    password: str | None = Field(None, description="SSH password for authentication")
    private_key_path: str | None = Field(None, description="Path to private key file")
    port: int = Field(22, description="SSH port number")


class TerminateComputeSchema(BaseModel):
    """Input schema for terminating GPU compute instances."""

    instance_id: str = Field(
        ...,
        description="The ID of the instance to terminate",
    )
