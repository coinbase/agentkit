"""Network configuration and utilities."""

from pydantic import BaseModel


class Network(BaseModel):
    """Represents a blockchain network."""

    protocol_family: str
    network_id: str | None = None
    chain_id: str | None = None
