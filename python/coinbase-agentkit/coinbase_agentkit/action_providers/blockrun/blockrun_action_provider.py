"""BlockRun action provider for pay-per-request LLM access via x402 micropayments.

BlockRun provides access to multiple LLM providers (OpenAI, Anthropic, Google, DeepSeek)
with pay-per-request USDC micropayments on Base chain using the x402 protocol.
No API keys needed - payments are signed using AgentKit's wallet provider.
"""

import json
from typing import Any

from x402.clients.requests import x402_requests

from ...network import Network
from ...wallet_providers.evm_wallet_provider import EvmWalletProvider
from ..action_decorator import create_action
from ..action_provider import ActionProvider
from .schemas import ChatCompletionSchema, GetUsdcBalanceSchema, ListModelsSchema

SUPPORTED_NETWORKS = ["base-mainnet", "base-sepolia"]

BLOCKRUN_API_URL = "https://blockrun.ai/api/v1"

# USDC contract addresses on Base
USDC_ADDRESSES = {
    "base-mainnet": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
}

# Minimal ERC20 ABI for balance checking
ERC20_BALANCE_ABI = [
    {
        "type": "function",
        "name": "balanceOf",
        "stateMutability": "view",
        "inputs": [{"name": "account", "type": "address"}],
        "outputs": [{"type": "uint256"}],
    },
    {
        "type": "function",
        "name": "decimals",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"type": "uint8"}],
    },
]

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
    USDC micropayments on Base chain. The x402 protocol handles payment automatically
    using AgentKit's wallet provider for signing - no private keys exposed.

    Features:
    - Access GPT-4o, Claude, Gemini, DeepSeek via single integration
    - Pay-per-request in USDC (no monthly subscriptions)
    - Uses AgentKit's wallet provider for secure signing
    - Built on Coinbase's x402 protocol
    """

    def __init__(self, api_url: str | None = None):
        """Initialize the BlockRun action provider.

        Args:
            api_url: Optional custom API URL. Defaults to https://blockrun.ai/api/v1

        """
        super().__init__("blockrun", [])
        self._api_url = api_url or BLOCKRUN_API_URL

    def _get_session(self, wallet_provider: EvmWalletProvider):
        """Create an x402-enabled requests session using the wallet provider.

        Args:
            wallet_provider: The wallet provider for x402 payment signing.

        Returns:
            x402 requests session configured with the wallet signer.

        """
        # Convert wallet provider to signer - no private key needed!
        signer = wallet_provider.to_signer()
        return x402_requests(signer)

    def _get_usdc_balance(
        self, wallet_provider: EvmWalletProvider
    ) -> tuple[float, str, str]:
        """Get the USDC balance for the wallet.

        Args:
            wallet_provider: The wallet provider to check balance for.

        Returns:
            Tuple of (balance_float, formatted_balance, usdc_address).

        Raises:
            ValueError: If the network is not supported or balance check fails.

        """
        from web3 import Web3

        network = wallet_provider.get_network()
        network_id = network.network_id

        if network_id not in USDC_ADDRESSES:
            raise ValueError(f"USDC not configured for network: {network_id}")

        usdc_address = USDC_ADDRESSES[network_id]
        wallet_address = wallet_provider.get_address()

        w3 = Web3()
        checksum_usdc = w3.to_checksum_address(usdc_address)
        checksum_wallet = w3.to_checksum_address(wallet_address)

        # Get decimals (USDC has 6 decimals)
        decimals = wallet_provider.read_contract(
            contract_address=checksum_usdc,
            abi=ERC20_BALANCE_ABI,
            function_name="decimals",
            args=[],
        )

        # Get balance
        balance_raw = wallet_provider.read_contract(
            contract_address=checksum_usdc,
            abi=ERC20_BALANCE_ABI,
            function_name="balanceOf",
            args=[checksum_wallet],
        )

        balance_float = balance_raw / (10**decimals)
        formatted_balance = f"{balance_float:.6f} USDC"

        return balance_float, formatted_balance, usdc_address

    @create_action(
        name="get_usdc_balance",
        description="""
Get the USDC balance for the wallet on Base chain.

This action checks your wallet's USDC balance to ensure you have sufficient funds
for BlockRun API requests. BlockRun uses USDC micropayments on Base for pay-per-request
LLM access.

Returns:
- Current USDC balance
- Wallet address
- Network information
- Funding instructions if balance is low""",
        schema=GetUsdcBalanceSchema,
    )
    def get_usdc_balance(
        self, wallet_provider: EvmWalletProvider, args: dict[str, Any]
    ) -> str:
        """Get the USDC balance for the wallet.

        Args:
            wallet_provider: The wallet provider to check balance for.
            args: Empty dict (no parameters required).

        Returns:
            str: JSON string containing balance information or error details.

        """
        try:
            balance, formatted_balance, usdc_address = self._get_usdc_balance(
                wallet_provider
            )
            wallet_address = wallet_provider.get_address()
            network = wallet_provider.get_network()

            result = {
                "success": True,
                "balance": balance,
                "formatted_balance": formatted_balance,
                "wallet_address": wallet_address,
                "usdc_contract": usdc_address,
                "network": network.network_id,
            }

            # Add funding suggestion if balance is low
            if balance < 0.10:
                result["warning"] = "Low USDC balance"
                result["suggestion"] = (
                    "Your USDC balance is low. To fund your wallet:\n"
                    "1. Transfer USDC to your wallet on Base\n"
                    "2. Bridge USDC from another chain using a bridge like https://bridge.base.org\n"
                    "3. Buy USDC on Coinbase and withdraw to your wallet on Base"
                )

            return json.dumps(result, indent=2)

        except Exception as e:
            return json.dumps(
                {
                    "error": True,
                    "message": f"Failed to get USDC balance: {e!s}",
                    "suggestion": "Ensure you are connected to Base mainnet or Base Sepolia.",
                },
                indent=2,
            )

    @create_action(
        name="chat_completion",
        description="""
Send a chat completion request to an LLM via BlockRun using x402 micropayments.

BlockRun provides access to multiple LLM providers with pay-per-request USDC payments
on Base chain. Payments are signed securely using your AgentKit wallet provider.

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
            # Check USDC balance before making the request
            try:
                balance, formatted_balance, _ = self._get_usdc_balance(wallet_provider)
                if balance < 0.01:  # Minimum balance threshold
                    return json.dumps(
                        {
                            "error": True,
                            "message": f"Insufficient USDC balance: {formatted_balance}",
                            "suggestion": (
                                "Your wallet needs USDC on Base to pay for BlockRun requests. "
                                "Please fund your wallet with USDC:\n"
                                "1. Transfer USDC to your wallet on Base\n"
                                "2. Bridge USDC from another chain\n"
                                "3. Buy USDC on Coinbase and withdraw to Base"
                            ),
                            "wallet_address": wallet_provider.get_address(),
                        },
                        indent=2,
                    )
            except Exception:
                # If balance check fails, continue anyway - the x402 request will fail
                # with a more specific error if there's actually a payment issue
                pass

            # Build messages
            messages = []
            if args.get("system_prompt"):
                messages.append({"role": "system", "content": args["system_prompt"]})
            messages.append({"role": "user", "content": args["prompt"]})

            # Create x402 session with wallet signer
            session = self._get_session(wallet_provider)

            # Make the request - x402 handles payment automatically
            response = session.post(
                f"{self._api_url}/chat/completions",
                json={
                    "model": args.get("model", "openai/gpt-4o-mini"),
                    "messages": messages,
                    "max_tokens": args.get("max_tokens", 1024),
                    "temperature": args.get("temperature", 0.7),
                },
            )

            response.raise_for_status()
            data = response.json()

            # Extract response content
            content = data["choices"][0]["message"]["content"]

            return json.dumps(
                {
                    "success": True,
                    "model": args.get("model", "openai/gpt-4o-mini"),
                    "response": content,
                    "usage": data.get("usage"),
                    "payment": "Paid via x402 micropayment on Base",
                },
                indent=2,
            )

        except Exception as e:
            error_message = str(e)
            suggestion = "Check your wallet has USDC on Base and the model name is valid."

            # Provide more specific error messages
            if "402" in error_message or "payment" in error_message.lower():
                suggestion = (
                    "Payment failed. Ensure your wallet has sufficient USDC on Base. "
                    "You can check your balance and fund your wallet at https://blockrun.ai"
                )
            elif "connection" in error_message.lower():
                suggestion = "Network error. Check your internet connection and try again."

            return json.dumps(
                {
                    "error": True,
                    "message": f"BlockRun chat completion failed: {error_message}",
                    "suggestion": suggestion,
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
    def list_models(self, wallet_provider: EvmWalletProvider, args: dict[str, Any]) -> str:
        """List available LLM models.

        Args:
            wallet_provider: The wallet provider (not used for this action).
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


def blockrun_action_provider(api_url: str | None = None) -> BlockrunActionProvider:
    """Create a new BlockRun action provider.

    BlockRun provides access to multiple LLM providers (OpenAI, Anthropic, Google,
    DeepSeek) with pay-per-request USDC micropayments on Base chain using x402.

    Args:
        api_url: Optional custom API URL. Defaults to https://blockrun.ai/api/v1

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
    return BlockrunActionProvider(api_url=api_url)
