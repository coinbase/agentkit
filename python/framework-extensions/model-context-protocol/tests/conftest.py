"""Test fixtures and mock providers for MCP extension tests."""

import threading
import time
from collections import defaultdict
from decimal import Decimal
from enum import Enum
from typing import Any

import pytest
from pydantic import BaseModel, ConfigDict, Field, field_validator

from coinbase_agentkit import AgentKit, AgentKitConfig
from coinbase_agentkit.action_providers.action_decorator import create_action
from coinbase_agentkit.action_providers.action_provider import ActionProvider
from coinbase_agentkit.network import Network
from coinbase_agentkit.wallet_providers.wallet_provider import WalletProvider


class Priority(str, Enum):
    """Priority level for complex action schema."""

    LOW = "low"
    HIGH = "high"


class AddNumbersSchema(BaseModel):
    """Schema for adding two integers."""

    a: int = Field(..., description="First integer")
    b: int = Field(..., description="Second integer")


class NestedMetadata(BaseModel):
    """Nested metadata for complex schema."""

    tag: str
    count: int = 1


class ComplexSchema(BaseModel):
    """Schema demonstrating enums and nested models."""

    label: str
    priority: Priority = Priority.LOW
    metadata: NestedMetadata | None = None


class CustomValidatorSchema(BaseModel):
    """Schema with custom validator that raises an exception with a secret."""

    token: str

    @field_validator("token")
    @classmethod
    def validate_token(cls, v: str) -> str:
        """Validate token and raise error containing sensitive text if secret is matched."""
        if "MOCK_SECRET" in v:
            raise ValueError(f"Custom validation failure with secret: {v}")
        return v


class ForbidExtraSchema(BaseModel):
    """Schema forbidding extra fields to test unexpected input field names."""

    model_config = ConfigDict(extra="forbid")
    count: int


class MockWalletProvider(WalletProvider):
    """Mock wallet provider for hermetic testing."""

    def get_address(self) -> str:
        """Get the mock wallet address."""
        return "0x1234567890abcdef1234567890abcdef12345678"

    def get_network(self) -> Network:
        """Get the mock network configuration."""
        return Network(chain_id="8453", protocol_family="evm", network_id="base-mainnet")

    def get_balance(self) -> Decimal:
        """Get the mock wallet balance."""
        return Decimal("1.5")

    def sign_message(self, message: str) -> str:
        """Sign a message with mock signature."""
        return f"mock_sig_{message}"

    def get_name(self) -> str:
        """Get the mock wallet provider name."""
        return "mock_wallet"

    def native_transfer(self, to: str, value: Decimal) -> str:
        """Execute a simulated transfer."""
        return f"tx_mock_{to}_{value}"


class MockActionProvider(ActionProvider[MockWalletProvider]):
    """Synthetic action provider covering all schema, return, and error variants."""

    def __init__(self) -> None:
        """Initialize the synthetic action provider."""
        super().__init__("mock_provider", [])
        self.call_counts: dict[str, int] = defaultdict(int)

    @create_action(
        name="add_numbers",
        description="Add two numbers together",
        schema=AddNumbersSchema,
    )
    def add_numbers(self, wallet_provider: MockWalletProvider, args: dict[str, Any]) -> str:
        """Add two integers and return a result string."""
        _ = wallet_provider
        self.call_counts["add_numbers"] += 1
        return f"Result: {args['a'] + args['b']}"

    @create_action(
        name="complex_action",
        description="Process complex payload with enum and nested object",
        schema=ComplexSchema,
    )
    def complex_action(
        self, wallet_provider: MockWalletProvider, args: dict[str, Any]
    ) -> dict[str, Any]:
        """Echo complex arguments back as a dictionary."""
        _ = wallet_provider
        self.call_counts["complex_action"] += 1
        return {"status": "success", "echo": args}

    @create_action(
        name="list_items",
        description="Return a list of items",
        schema=None,
    )
    def list_items(self, wallet_provider: MockWalletProvider, args: dict[str, Any]) -> list[str]:
        """Return a list of string elements."""
        _ = wallet_provider, args
        self.call_counts["list_items"] += 1
        return ["item_alpha", "item_beta"]

    @create_action(
        name="scalar_result",
        description="Return a scalar integer",
        schema=None,
    )
    def scalar_result(self, wallet_provider: MockWalletProvider, args: dict[str, Any]) -> int:
        """Return a scalar integer."""
        _ = wallet_provider, args
        self.call_counts["scalar_result"] += 1
        return 42

    @create_action(
        name="none_result",
        description="Return None to test void action handling",
        schema=None,
    )
    def none_result(self, wallet_provider: MockWalletProvider, args: dict[str, Any]) -> None:
        """Return None to simulate void action."""
        _ = wallet_provider, args
        self.call_counts["none_result"] += 1

    @create_action(
        name="failing_action",
        description="Action that raises a runtime exception",
        schema=None,
    )
    def failing_action(self, wallet_provider: MockWalletProvider, args: dict[str, Any]) -> str:
        """Simulate an action failure by raising an exception."""
        _ = wallet_provider, args
        self.call_counts["failing_action"] += 1
        raise RuntimeError("Simulated transaction revert: insufficient gas")

    @create_action(
        name="leak_sensitive_action",
        description="Action raising exception with URL query token and filesystem path",
        schema=None,
    )
    def leak_sensitive_action(
        self, wallet_provider: MockWalletProvider, args: dict[str, Any]
    ) -> str:
        """Raise an exception containing simulated secrets and paths."""
        _ = wallet_provider, args
        self.call_counts["leak_sensitive_action"] += 1
        raise RuntimeError(
            "Failed connecting to https://internal.node.io/rpc?token=SECRET_AUTH_TOKEN_98765 "
            "using key at /Users/admin/.credentials/wallet_secret.json"
        )

    @create_action(
        name="custom_validate_action",
        description="Action testing custom validation message",
        schema=CustomValidatorSchema,
    )
    def custom_validate_action(
        self, wallet_provider: MockWalletProvider, args: dict[str, Any]
    ) -> str:
        """Execute custom validate action."""
        _ = wallet_provider, args
        self.call_counts["custom_validate_action"] += 1
        return "validated"

    @create_action(
        name="strict_extra_action",
        description="Action testing forbidden extra fields",
        schema=ForbidExtraSchema,
    )
    def strict_extra_action(self, wallet_provider: MockWalletProvider, args: dict[str, Any]) -> str:
        """Execute strict extra action."""
        _ = wallet_provider, args
        self.call_counts["strict_extra_action"] += 1
        return "ok"

    @create_action(
        name="slow_thread_action",
        description="Action that records its executing thread identifier",
        schema=None,
    )
    def slow_thread_action(
        self, wallet_provider: MockWalletProvider, args: dict[str, Any]
    ) -> dict[str, Any]:
        """Record the active thread identifier and name."""
        _ = wallet_provider, args
        self.call_counts["slow_thread_action"] += 1
        time.sleep(0.02)
        return {
            "thread_id": threading.get_ident(),
            "thread_name": threading.current_thread().name,
        }

    def supports_network(self, network: Network) -> bool:
        """Check whether the network is supported."""
        _ = network
        return True


@pytest.fixture
def mock_wallet() -> MockWalletProvider:
    """Fixture providing a mock wallet provider."""
    return MockWalletProvider()


@pytest.fixture
def mock_provider() -> MockActionProvider:
    """Fixture providing a synthetic action provider."""
    return MockActionProvider()


@pytest.fixture
def agent_kit(mock_wallet: MockWalletProvider, mock_provider: MockActionProvider) -> AgentKit:
    """Fixture providing an AgentKit instance with synthetic providers."""
    return AgentKit(
        AgentKitConfig(
            wallet_provider=mock_wallet,
            action_providers=[mock_provider],
        )
    )


@pytest.fixture
def all_action_names(agent_kit: AgentKit) -> list[str]:
    """Fixture providing the complete list of available action names."""
    return [action.name for action in agent_kit.get_actions()]
