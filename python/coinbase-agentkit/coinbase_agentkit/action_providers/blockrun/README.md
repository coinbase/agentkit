# BlockRun Action Provider

The BlockRun action provider enables AI agents to access multiple LLM providers (OpenAI, Anthropic, Google, DeepSeek) using pay-per-request USDC micropayments on Base chain via the x402 protocol.

## Features

- **Multi-provider access**: GPT-4o, Claude, Gemini, DeepSeek through a single integration
- **Pay-per-request**: No monthly subscriptions - pay only for what you use in USDC
- **Secure**: Private key never leaves your machine (local EIP-712 signing)
- **Native x402**: Built on Coinbase's HTTP 402 payment protocol

## Installation

```bash
pip install blockrun-llm
```

## Usage

### With AgentKit

```python
from coinbase_agentkit import (
    AgentKit,
    AgentKitConfig,
    CdpEvmWalletProvider,
    CdpEvmWalletProviderConfig,
    blockrun_action_provider,
)

# Initialize wallet provider
wallet_provider = CdpEvmWalletProvider(CdpEvmWalletProviderConfig(
    api_key_id="your-cdp-api-key-id",
    api_key_secret="your-cdp-api-key-secret",
    wallet_secret="your-wallet-secret",
    network_id="base-mainnet",
))

# Create AgentKit with BlockRun
agentkit = AgentKit(AgentKitConfig(
    wallet_provider=wallet_provider,
    action_providers=[blockrun_action_provider()],
))
```

### With Environment Variable

Set `BLOCKRUN_WALLET_KEY` to your Base wallet private key:

```bash
export BLOCKRUN_WALLET_KEY="0x..."
```

Then use without explicit key:

```python
agentkit = AgentKit(AgentKitConfig(
    wallet_provider=wallet_provider,
    action_providers=[blockrun_action_provider()],
))
```

### With Explicit Wallet Key

```python
agentkit = AgentKit(AgentKitConfig(
    wallet_provider=wallet_provider,
    action_providers=[blockrun_action_provider(wallet_key="0x...")],
))
```

## Available Actions

### chat_completion

Send a chat completion request to an LLM via BlockRun.

**Parameters:**
- `model` (string, optional): Model to use. Default: `openai/gpt-4o-mini`
- `prompt` (string, required): The user message or prompt
- `system_prompt` (string, optional): System prompt for context
- `max_tokens` (integer, optional): Maximum tokens to generate. Default: 1024
- `temperature` (float, optional): Sampling temperature (0-2). Default: 0.7

**Available Models:**
- `openai/gpt-4o` - Most capable GPT-4 model with vision
- `openai/gpt-4o-mini` - Fast and cost-effective GPT-4
- `anthropic/claude-sonnet-4` - Anthropic's balanced model
- `google/gemini-2.0-flash` - Google's fast multimodal model
- `deepseek/deepseek-chat` - DeepSeek's general-purpose model

**Example:**
```python
result = agentkit.run_action(
    "BlockrunActionProvider_chat_completion",
    {
        "model": "anthropic/claude-sonnet-4",
        "prompt": "Explain quantum computing in simple terms",
        "max_tokens": 500,
    }
)
```

### list_models

List all available LLM models with descriptions.

**Example:**
```python
result = agentkit.run_action("BlockrunActionProvider_list_models", {})
```

## Network Support

BlockRun supports:
- `base-mainnet` - Base Mainnet (production)
- `base-sepolia` - Base Sepolia (testnet)

Ensure your wallet has USDC on the appropriate network.

## How It Works

1. Your agent calls `chat_completion` with a prompt
2. BlockRun creates an x402 payment request
3. Your wallet signs the payment locally (EIP-712)
4. The signed payment is sent with the LLM request
5. BlockRun forwards to the LLM provider and returns the response
6. USDC is transferred from your wallet to cover the request cost

## Links

- [BlockRun Documentation](https://blockrun.ai/docs)
- [x402 Protocol](https://www.x402.org/)
- [Python SDK](https://github.com/blockrunai/blockrun-llm)
