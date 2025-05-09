"""Shared types for CDP server wallet providers."""

from typing import Protocol

from cdp import CdpClient

from .evm_wallet_provider import EvmWalletProvider


class WalletProviderWithClient(Protocol):
    """A wallet provider that has a get_client method."""

    def get_client(self) -> CdpClient:
        """Get the CDP client.

        Returns:
            CdpClient: The CDP client.
        """
        ... 