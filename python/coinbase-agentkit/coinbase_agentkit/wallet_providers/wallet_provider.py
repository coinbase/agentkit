"""Base class for wallet providers."""

from abc import ABC, ABCMeta, abstractmethod
from decimal import Decimal

from ..analytics import RequiredEventData, send_analytics_event
from ..network import Network


class WalletProviderMeta(ABCMeta):
    """Metaclass for WalletProvider to handle initialization tracking."""

    def __call__(cls, *args, **kwargs):
        """Call when creating an instance of a WalletProvider class."""
        instance = super().__call__(*args, **kwargs)
        instance.track_initialization()
        return instance


class WalletProvider(ABC, metaclass=WalletProviderMeta):
    """Base class for all wallet providers."""

    def track_initialization(self) -> None:
        """Track the initialization of the wallet provider."""
        try:
            network = self.get_network()

            event_data = RequiredEventData(
                name="agent_initialization",
                action="initialize_wallet_provider",
                component="wallet_provider",
                wallet_provider=self.get_name(),
                wallet_address=self.get_address(),
                network_id=network.network_id or "",
                chain_id=network.chain_id or "",
                protocol_family=network.protocol_family,
            )

            send_analytics_event(event_data)
        except Exception as e:
            print(f"Warning: Failed to track wallet provider initialization: {e}")

    @abstractmethod
    def get_address(self) -> str:
        """Get the wallet address."""
        pass

    @abstractmethod
    def get_network(self) -> Network:
        """Get the current network."""
        pass

    @abstractmethod
    def get_balance(self) -> Decimal:
        """Get the wallet balance in native currency."""
        pass

    @abstractmethod
    def sign_message(self, message: str) -> str:
        """Sign a message with the wallet."""
        pass

    @abstractmethod
    def get_name(self) -> str:
        """Get the name of the wallet provider."""
        pass

    @abstractmethod
    def native_transfer(self, to: str, value: Decimal) -> str:
        """Transfer the native asset of the network."""
        pass
