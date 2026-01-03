from decimal import Decimal

import pytest
from pydantic import BaseModel

from coinbase_agentkit import (
    ActionProvider,
    AgentKit,
    AgentKitConfig,
    WalletProvider,
    create_action,
)
from coinbase_agentkit.network import Network


class AddNumbersSchema(BaseModel):
    """Schema for adding two numbers."""

    a: int
    b: int


class SubtractNumbersSchema(BaseModel):
    """Schema for subtracting two numbers."""

    a: int
    b: int


class MockWalletProvider(WalletProvider):
    """Mock wallet provider for testing."""

    def get_address(self) -> str:
        """Get the wallet address."""
        return "addr_9876543210"

    def get_network(self) -> Network:
        """Get the network information."""
        return Network(chain_id="1", protocol_family="testnet")

    def get_balance(self) -> Decimal:
        """Get the wallet balance."""
        return Decimal("22.0")

    def sign_message(self, message: str) -> str:
        """Sign a message with the wallet."""
        return f"test_singed_{message}"

    def get_name(self) -> str:
        """Get the wallet name."""
        return "test_wallet"

    def native_transfer(self, to: str, value: Decimal) -> str:
        """Transfer native tokens to the specified address."""
        return f"test_hash_transfer_{to}_{value}"


class MockActionProvider(ActionProvider[MockWalletProvider]):
    """Mock action provider with simple arithmetic actions."""

    def __init__(self) -> None:
        super().__init__("test_action_provider", [])

    @create_action(
        name="add",
        description="Add two numbers together",
        schema=AddNumbersSchema,
    )
    def add_numbers(self, wallet_provider: MockWalletProvider, args: dict) -> str:
        """Add two numbers and return the result."""
        _ = wallet_provider  # Unused but required by interface
        result = args["a"] + args["b"]
        return f"The sum of {args['a']} and {args['b']} is {result}"

    @create_action(
        name="subtract",
        description="Subtract second number from first number",
        schema=SubtractNumbersSchema,
    )
    def subtract_numbers(self, wallet_provider: MockWalletProvider, args: dict) -> str:
        """Subtract two numbers and return the result."""
        _ = wallet_provider  # Unused but required by interface
        result = args["a"] - args["b"]
        return f"The result of {args['a']} minus {args['b']} is {result}"

    @create_action(name="get_wallet_info", description="Get wallet information", schema=None)
    def get_wallet_info(self, wallet_provider: MockWalletProvider, args: dict) -> str:
        """Get wallet information."""
        _ = args  # Unused but required by interface
        return f"Wallet: {wallet_provider.get_name()}, Address: {wallet_provider.get_address()}, Balance: {wallet_provider.get_balance()}"

    def supports_network(self, _: Network) -> bool:
        """Check if the network is supported by this action provider."""
        return True


@pytest.fixture
def wallet_provider():
    """Create a wallet provider instance."""
    return MockWalletProvider()


@pytest.fixture
def action_provider():
    """Create an action provider instance."""
    return MockActionProvider()


@pytest.fixture
def agent_kit(wallet_provider, action_provider):
    """Create an AgentKit instance with test providers."""
    return AgentKit(
        AgentKitConfig(
            wallet_provider=wallet_provider,
            action_providers=[action_provider],
        )
    )


class ErrorActionProvider(ActionProvider[MockWalletProvider]):
    """Action provider that raises an error in its action."""

    def __init__(self) -> None:
        super().__init__("error_provider", [])

    @create_action(
        name="error_action",
        description="A simple test action with error",
        schema=AddNumbersSchema,
    )
    def error_action(self, wallet_provider: MockWalletProvider, args: dict):
        """Actions that raises an error."""
        _ = wallet_provider  # Unused but required by interface
        raise ValueError("Intentional error for testing")

    def supports_network(self, network: Network) -> bool:
        """Check if the network is supported by this action provider."""
        _ = network  # Unused but required by interface
        return True
