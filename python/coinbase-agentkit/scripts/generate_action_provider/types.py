"""Type definitions for the action provider generator script."""

from dataclasses import dataclass
from typing import Literal, TypedDict

ProtocolFamily = Literal["all", "evm"] | None
NetworkId = str
WalletProvider = str


@dataclass
class ProviderConfig:
    """Configuration for an action provider."""

    name: str
    protocol_family: ProtocolFamily
    network_ids: list[NetworkId]
    wallet_provider: WalletProvider | None = None
    provider_key: str = "default"


class PromptResult(TypedDict, total=False):
    """Result from the prompts."""

    name: str
    overwrite: bool
    protocol_family: ProtocolFamily
    network_ids: list[NetworkId] | None
    wallet_provider: WalletProvider | None
