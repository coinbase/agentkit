"""BlockRun action provider for pay-per-request LLM access via x402 micropayments.

BlockRun provides access to multiple LLM providers (OpenAI, Anthropic, Google, DeepSeek)
with pay-per-request USDC micropayments on Base chain using the x402 protocol.
No API keys needed - payments are signed locally using your wallet.
"""

import json
import os
from typing import Any

from ...network import Network
from ...wallet_providers.evm_wallet_provider import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import ChatCompletionSchema, ListModelsSchema

SUPPORTED_NETWORKS = ["base-mainnet", "base-sepolia"]

AVAILABLE_MODELS = {
    "openai/gpt-4o": {
        "name": "GPT-4o",
        "provider": "OpenAI",
        "description": "Most capable GPT-4 model with vision capabilities",
    },
    "openai/gpt-4o-mini": {
        "name": "GPT-4o Mini",
        "provider": "OpenAI",
        "description": "Fast and cost-effective GPT-4 model",
    },
    "anthropic/claude-sonnet-4": {
        "name": "Claude Sonnet 4",
        "provider": "Anthropic",
        "description": "Anthropic's balanced model for most tasks",
    },
    "google/gemini-2.0-flash": {
        "name": "Gemini 2.0 Flash",
        "provider": "Google",
        "description": "Google's fast multimodal model",
    },
    "deepseek/deepseek-chat": {
        "name": "DeepSeek Chat",
        "provider": "DeepSeek",
        "description": "DeepSeek's general-purpose chat model",
    },
}


class BlockrunActionProvider(ActionProvider[EvmWalletProvider]):
    """Action provider for BlockRun LLM services via x402 micropayments.

    BlockRun enables AI agents to access multiple LLM providers using pay-per-request
    USDC micropayments on Base chain. The x402 protocol handles payment automatically -
    just provide your wallet and make requests.

    Features:
    - Access GPT-4o, Claude, Gemini, DeepSeek via single integration
    - Pay-per-request in USDC (no monthly subscriptions)
    - Private key never leaves your machine (local EIP-712 signing)
    - Built on Coinbase's x402 protocol
    """

    def __init__(self, wallet_key: str | None = None):
        """Initialize the BlockRun action provider.

        Args:
            wallet_key: Optional wallet private key for x402 payments.
                        If not provided, will attempt to read from BLOCKRUN_WALLET_KEY
                        environment variable. If using with AgentKit, the wallet provider's
                        key will be used automatically.

        """
        super().__init__("blockrun", [])
        self._wallet_key = wallet_key or os.getenv("BLOCKRUN_WALLET_KEY")
        self._client = None

    def _get_client(self, wallet_provider: EvmWalletProvider | None = None):
        """Get or create the BlockRun LLM client.

        Args:
            wallet_provider: Optional wallet provider to extract private key from.

        Returns:
            LLMClient instance.

        Raises:
            ImportError: If blockrun-llm package is not installed.
            ValueError: If no wallet key is available.

        """
        if self._client is not None:
            return self._client

        try:
            from blockrun_llm import LLMClient
        except ImportError as e:
            raise ImportError(
                "BlockRun provider requires blockrun-llm package. "
                "Install with: pip install blockrun-llm"
            ) from e

        # Try to get wallet key from provider or stored key
        wallet_key = self._wallet_key
        if (
            wallet_key is None
            and wallet_provider is not None
            and hasattr(wallet_provider, "_account")
            and hasattr(wallet_provider._account, "key")
        ):
            # Try to extract private key from wallet provider
            # This works with EthAccountWalletProvider
            wallet_key = wallet_provider._account.key.hex()

        if wallet_key is None:
            raise ValueError(
                "No wallet key available. Either pass wallet_key to blockrun_action_provider(), "
                "set BLOCKRUN_WALLET_KEY environment variable, or use a wallet provider "
                "that exposes the private key."
            )

        self._client = LLMClient(private_key=wallet_key)
        return self._client

    @create_action(
        name="chat_completion",
        description="""
Send a chat completion request to an LLM via BlockRun using x402 micropayments.

BlockRun provides access to multiple LLM providers with pay-per-request USDC payments
on Base chain. No API keys needed - payments are signed locally using your wallet.

Available models:
- openai/gpt-4o: Most capable GPT-4 model with vision capabilities
- openai/gpt-4o-mini: Fast and cost-effective GPT-4 model (default)
- anthropic/claude-sonnet-4: Anthropic's balanced model for most tasks
- google/gemini-2.0-flash: Google's fast multimodal model
- deepseek/deepseek-chat: DeepSeek's general-purpose chat model

EXAMPLES:
- Simple question: chat_completion(prompt="What is the capital of France?")
- With system prompt: chat_completion(prompt="Write a poem", system_prompt="You are a creative poet")
- Using Claude: chat_completion(model="anthropic/claude-sonnet-4", prompt="Explain quantum computing")

The payment is processed automatically via x402 - a small USDC fee is deducted per request.""",
        schema=ChatCompletionSchema,
    )
    def chat_completion(
        self, wallet_provider: EvmWalletProvider, args: dict[str, Any]
    ) -> str:
        """Send a chat completion request via BlockRun.

        Args:
            wallet_provider: The wallet provider for x402 payment signing.
            args: Request parameters including model, prompt, system_prompt, etc.

        Returns:
            str: JSON string containing the model's response or error details.

        """
        try:
            client = self._get_client(wallet_provider)

            # Build messages
            messages = []
            if args.get("system_prompt"):
                messages.append({"role": "system", "content": args["system_prompt"]})
            messages.append({"role": "user", "content": args["prompt"]})

            # Make the request
            response = client.chat_completion(
                model=args.get("model", "openai/gpt-4o-mini"),
                messages=messages,
                max_tokens=args.get("max_tokens", 1024),
                temperature=args.get("temperature", 0.7),
            )

            # Extract response content
            content = response.choices[0].message.content

            return json.dumps(
                {
                    "success": True,
                    "model": args.get("model", "openai/gpt-4o-mini"),
                    "response": content,
                    "usage": {
                        "prompt_tokens": getattr(response.usage, "prompt_tokens", None),
                        "completion_tokens": getattr(
                            response.usage, "completion_tokens", None
                        ),
                        "total_tokens": getattr(response.usage, "total_tokens", None),
                    }
                    if hasattr(response, "usage") and response.usage
                    else None,
                    "payment": "Paid via x402 micropayment on Base",
                },
                indent=2,
            )

        except ImportError as e:
            return json.dumps(
                {
                    "error": True,
                    "message": str(e),
                    "suggestion": "Install blockrun-llm: pip install blockrun-llm",
                },
                indent=2,
            )
        except Exception as e:
            return json.dumps(
                {
                    "error": True,
                    "message": f"BlockRun chat completion failed: {e!s}",
                    "suggestion": "Check your wallet has USDC on Base and the model name is valid.",
                },
                indent=2,
            )

    @create_action(
        name="list_models",
        description="""
List all available LLM models accessible via BlockRun.

Returns information about each model including the provider, name, and description.
All models are accessible via pay-per-request USDC micropayments on Base chain.""",
        schema=ListModelsSchema,
    )
    def list_models(self, args: dict[str, Any]) -> str:
        """List available LLM models.

        Args:
            args: Empty dict (no parameters required).

        Returns:
            str: JSON string containing available models.

        """
        return json.dumps(
            {
                "success": True,
                "models": AVAILABLE_MODELS,
                "payment_info": {
                    "network": "Base (Mainnet or Sepolia)",
                    "currency": "USDC",
                    "method": "x402 micropayments",
                },
            },
            indent=2,
        )

    def supports_network(self, network: Network) -> bool:
        """Check if the network is supported by this action provider.

        Args:
            network: The network to check support for.

        Returns:
            bool: Whether the network is supported.

        """
        return network.protocol_family == "evm" and network.network_id in SUPPORTED_NETWORKS


def blockrun_action_provider(wallet_key: str | None = None) -> BlockrunActionProvider:
    """Create a new BlockRun action provider.

    BlockRun provides access to multiple LLM providers (OpenAI, Anthropic, Google,
    DeepSeek) with pay-per-request USDC micropayments on Base chain using x402.

    Args:
        wallet_key: Optional wallet private key for x402 payments.
                    If not provided, will attempt to read from BLOCKRUN_WALLET_KEY
                    environment variable. When used with AgentKit, the wallet
                    provider's key can be used automatically.

    Returns:
        BlockrunActionProvider: A new BlockRun action provider instance.

    Example:
        ```python
        from coinbase_agentkit import AgentKit, AgentKitConfig, blockrun_action_provider

        agentkit = AgentKit(AgentKitConfig(
            wallet_provider=wallet_provider,
            action_providers=[blockrun_action_provider()],
        ))
        ```

    Learn more: https://blockrun.ai/docs

    """
    return BlockrunActionProvider(wallet_key=wallet_key)
