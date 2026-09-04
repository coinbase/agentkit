"""Test fixtures for CrewAI tools tests."""

from decimal import Decimal
from typing import Any

import pytest
from pydantic import BaseModel

from coinbase_agentkit import AgentKit, AgentKitConfig
from coinbase_agentkit.action_providers.action_decorator import create_action
from coinbase_agentkit.action_providers.action_provider import ActionProvider
from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers.wallet_provider import WalletProvider


class AddNumbersSchema(BaseModel):
    """Schema for adding two numbers."""

    a: int
    b: int


class OptionalMessageSchema(BaseModel):
    """Schema with an optional field."""

    content: str
    priority: str = "normal"


class MockWalletProvider(WalletProvider):  # type: ignore[misc]
    """Mock wallet provider for testing."""

    def get_address(self) -> str:
        """Get the wallet address."""
        return "0x1234567890abcdef1234567890abcdef12345678"

    def get_network(self) -> Network:
        """Get the network information."""
        return Network(chain_id="1", protocol_family="ethereum")

    def get_balance(self) -> Decimal:
        """Get the wallet balance."""
        return Decimal("1.5")

    def sign_message(self, message: str) -> str:
        """Sign a message with the wallet."""
        return f"signature_for_{message}"

    def get_name(self) -> str:
        """Get the wallet name."""
        return "test_wallet"

    def native_transfer(self, to: str, value: Decimal) -> str:
        """Transfer native tokens to the specified address."""
        return f"tx_hash_transfer_{to}_{value}"


class MockActionProvider(ActionProvider[MockWalletProvider]):  # type: ignore[misc]
    """Mock action provider with simple actions."""

    def __init__(self) -> None:
        super().__init__("test_provider", [])

    @create_action(  # type: ignore[untyped-decorator]
        name="add_numbers",
        description="Add two integers together",
        schema=AddNumbersSchema,
    )
    def add_numbers(self, wallet_provider: MockWalletProvider, args: dict[str, Any]) -> str:
        """Add two numbers and return the result."""
        _ = wallet_provider
        result = args["a"] + args["b"]
        return f"Addition result: {args['a']} + {args['b']} = {result}"

    @create_action(  # type: ignore[untyped-decorator]
        name="create_message",
        description="Create a formatted message with optional priority",
        schema=OptionalMessageSchema,
    )
    def create_message(self, wallet_provider: MockWalletProvider, args: dict[str, Any]) -> str:
        """Create a formatted message."""
        _ = wallet_provider
        return f"Message [{args.get('priority', 'normal').upper()}]: {args['content']}"

    @create_action(  # type: ignore[untyped-decorator]
        name="get_wallet_info",
        description="Get wallet information",
        schema=None,
    )
    def get_wallet_info(self, wallet_provider: MockWalletProvider, args: dict[str, Any]) -> str:
        """Get wallet information."""
        _ = args
        return (
            f"Wallet: {wallet_provider.get_name()}, "
            f"Address: {wallet_provider.get_address()}, "
            f"Balance: {wallet_provider.get_balance()}"
        )

    def supports_network(self, network: Network) -> bool:
        """Check if the network is supported by this action provider."""
        return bool(network.protocol_family == "ethereum")


@pytest.fixture
def agent_kit() -> AgentKit:
    """Create an AgentKit instance with test providers."""
    return AgentKit(
        AgentKitConfig(
            wallet_provider=MockWalletProvider(),
            action_providers=[MockActionProvider()],
        )
    )
