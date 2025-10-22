"""Test fixtures for PydanticAI tools tests."""

from decimal import Decimal

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


class SubtractNumbersSchema(BaseModel):
    """Schema for subtracting two numbers."""

    a: int
    b: int


class MultiplyNumbersSchema(BaseModel):
    """Schema for multiplying two numbers."""

    x: float
    y: float


class CreateMessageSchema(BaseModel):
    """Schema for creating a message."""

    content: str
    priority: str = "normal"


class MockWalletProvider(WalletProvider):
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


class MockActionProvider(ActionProvider[MockWalletProvider]):
    """Mock action provider with various test actions."""

    def __init__(self) -> None:
        super().__init__("test_provider", [])

    @create_action(
        name="add_numbers",
        description="Add two integers together",
        schema=AddNumbersSchema,
    )
    def add_numbers(self, wallet_provider: MockWalletProvider, args: dict) -> str:
        """Add two numbers and return the result."""
        _ = wallet_provider  # Unused but required by interface
        result = args["a"] + args["b"]
        return f"Addition result: {args['a']} + {args['b']} = {result}"

    @create_action(
        name="subtract_numbers",
        description="Subtract second number from first number",
        schema=SubtractNumbersSchema,
    )
    def subtract_numbers(self, wallet_provider: MockWalletProvider, args: dict) -> str:
        """Subtract two numbers and return the result."""
        _ = wallet_provider  # Unused but required by interface
        result = args["a"] - args["b"]
        return f"Subtraction result: {args['a']} - {args['b']} = {result}"

    @create_action(
        name="multiply_floats",
        description="Multiply two floating point numbers",
        schema=MultiplyNumbersSchema,
    )
    def multiply_floats(self, wallet_provider: MockWalletProvider, args: dict) -> str:
        """Multiply two float numbers and return the result."""
        _ = wallet_provider  # Unused but required by interface
        result = args["x"] * args["y"]
        return f"Multiplication result: {args['x']} * {args['y']} = {result}"

    @create_action(
        name="create_message",
        description="Create a formatted message with optional priority",
        schema=CreateMessageSchema,
    )
    def create_message(self, wallet_provider: MockWalletProvider, args: dict) -> str:
        """Create a formatted message."""
        _ = wallet_provider  # Unused but required by interface
        content = args["content"]
        priority = args.get("priority", "normal")
        return f"Message [{priority.upper()}]: {content}"

    @create_action(
        name="get_wallet_info",
        description="Get wallet information",
        schema=None,  # No arguments required
    )
    def get_wallet_info(self, wallet_provider: MockWalletProvider, args: dict) -> str:
        """Get wallet information."""
        _ = args  # Unused but required by interface
        return f"Wallet: {wallet_provider.get_name()}, Address: {wallet_provider.get_address()}, Balance: {wallet_provider.get_balance()}"

    def supports_network(self, network: Network) -> bool:
        """Check if the network is supported by this action provider."""
        return network.protocol_family in ["ethereum", "mock"]


@pytest.fixture
def wallet_provider():
    """Create a wallet provider instance."""
    return MockWalletProvider()


@pytest.fixture
def action_provider():
    """Create an action provider instance."""
    return MockActionProvider()


@pytest.fixture
def agent_kit():
    """Create an AgentKit instance with test providers."""
    return AgentKit(
        AgentKitConfig(
            wallet_provider=MockWalletProvider(),
            action_providers=[MockActionProvider()],
        )
    )


@pytest.fixture
def minimal_agent_kit():
    """Create a minimal AgentKit instance for basic tests."""

    class MinimalActionProvider(ActionProvider[MockWalletProvider]):
        def __init__(self) -> None:
            super().__init__("minimal_provider", [])

        @create_action(
            name="simple_action",
            description="A simple test action",
            schema=AddNumbersSchema,
        )
        def simple_action(self, wallet_provider: MockWalletProvider, args: dict) -> str:
            _ = wallet_provider  # Unused but required by interface
            return f"Simple result: {args['a'] + args['b']}"

        def supports_network(self, network: Network) -> bool:
            _ = network  # Unused but required by interface
            return True

    return AgentKit(
        AgentKitConfig(
            wallet_provider=MockWalletProvider(),
            action_providers=[MinimalActionProvider()],
        )
    )
