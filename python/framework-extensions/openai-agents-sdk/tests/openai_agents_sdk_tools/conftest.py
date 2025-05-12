"""Test fixtures for OpenAI Agents SDK tools tests."""

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


class MockWalletProvider(WalletProvider):
    """Mock wallet provider for testing."""

    def get_address(self) -> str:
        """Get the wallet address."""
        return "mock_address_123"

    def get_network(self) -> Network:
        """Get the network information."""
        return Network(chain_id="1", protocol_family="mock")

    def get_balance(self) -> Decimal:
        """Get the wallet balance."""
        return Decimal("100.0")

    def sign_message(self, message: str) -> str:
        """Sign a message with the wallet."""
        return f"mock_signed_{message}"

    def get_name(self) -> str:
        """Get the wallet name."""
        return "mock_wallet"

    def native_transfer(self, to: str, value: Decimal) -> str:
        """Transfer native tokens to the specified address."""
        return "mock_tx_hash"


class MockActionProvider(ActionProvider[MockWalletProvider]):
    """Mock action provider with simple arithmetic actions."""

    def __init__(self) -> None:
        super().__init__("mock_provider", [])

    @create_action(
        name="add",
        description="Add two numbers together",
        schema=AddNumbersSchema,
    )
    def add_numbers(self, wallet_provider: MockWalletProvider, args: dict) -> str:
        """Add two numbers and return the result."""
        result = args["a"] + args["b"]
        return f"The sum of {args['a']} and {args['b']} is {result}"

    @create_action(
        name="subtract",
        description="Subtract second number from first number",
        schema=SubtractNumbersSchema,
    )
    def subtract_numbers(self, wallet_provider: MockWalletProvider, args: dict) -> str:
        """Subtract two numbers and return the result."""
        result = args["a"] - args["b"]
        return f"The result of {args['a']} minus {args['b']} is {result}"

    def supports_network(self, network: Network) -> bool:
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
def agent_kit():
    """Create an AgentKit instance with test providers."""
    return AgentKit(
        AgentKitConfig(
            wallet_provider=MockWalletProvider(),
            action_providers=[MockActionProvider()],
        )
    )
