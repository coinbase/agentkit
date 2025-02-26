"""Type definitions for the action provider generator script."""

from typing import Literal, TypedDict

# Protocol family types
ProtocolFamily = Literal["all", "evm"]
NetworkId = str
WalletProvider = str

class ProviderConfig(TypedDict):
    """Configuration for an action provider."""

    name: str
    protocol_family: ProtocolFamily
    network_ids: list[NetworkId]
    wallet_provider: WalletProvider

class PromptResult(TypedDict, total=False):
    """Result from the prompts."""

    name: str
    overwrite: bool
    protocol_family: ProtocolFamily
    network_ids: list[NetworkId] | None
    wallet_provider: WalletProvider | None
