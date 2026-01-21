# BlockRun Action Provider

Access multiple frontier LLMs (GPT-4o, Claude, Gemini, DeepSeek) with pay-per-request USDC micropayments on Base chain.

## How It Works

BlockRun uses the **x402 protocol** - an HTTP-native payment standard built by Coinbase:

```
┌─────────────┐     1. Request LLM      ┌─────────────┐
│   AgentKit  │ ──────────────────────► │  BlockRun   │
│   + Wallet  │                         │    API      │
│   Provider  │ ◄────────────────────── │             │
└─────────────┘   2. 402 + price info   └─────────────┘
       │                                       │
       │ 3. Sign payment                       │
       │    (via wallet provider)              │
       ▼                                       │
┌─────────────┐                                │
│   x402      │   4. Retry with signed         │
│   Library   │      payment header            │
│             │ ──────────────────────────────►│
└─────────────┘                                │
       │                                       │
       │         5. Verify & settle via        │
       │            CDP Facilitator            │
       │◄──────────────────────────────────────┘
       │
       ▼
   6. LLM Response
```

**Key point:** Your private keys are **never exposed**. The wallet provider handles signing through its secure infrastructure (CDP server-side signing, Viem, etc.).

## Installation

BlockRun uses AgentKit's built-in x402 support - **no extra dependencies needed**:

```bash
pip install coinbase-agentkit
```

## Usage

```python
from coinbase_agentkit import AgentKit, AgentKitConfig, blockrun_action_provider
from coinbase_agentkit.wallet_providers import CdpEvmWalletProvider, CdpEvmWalletProviderConfig

# Setup wallet provider (works with ANY AgentKit wallet provider)
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

# Make an LLM request - payment handled automatically!
result = agentkit.execute_action(
    "chat_completion",
    {
        "prompt": "What is the capital of France?",
        "model": "openai/gpt-4o-mini",
    }
)
print(result)
```

## Wallet Provider Compatibility

BlockRun works with **any AgentKit EVM wallet provider**:

| Provider | Signing Location | Use Case |
|----------|------------------|----------|
| `CdpEvmWalletProvider` | Coinbase servers | Production (recommended) |
| `CdpSmartWalletProvider` | Coinbase servers | Smart contract wallets |
| `EthAccountWalletProvider` | Local | Testing & development |
| `ViemWalletProvider` | Configurable | Viem integration |
| `PrivyEvmWalletProvider` | Privy servers | Privy apps |

**No private key environment variables needed!** The wallet provider handles all signing securely.

## Available Actions

### `chat_completion`

Send a chat completion request to an LLM.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | - | The user message to send |
| `model` | string | No | `openai/gpt-4o-mini` | Model to use |
| `system_prompt` | string | No | - | System prompt for context |
| `max_tokens` | integer | No | 1024 | Maximum tokens in response |
| `temperature` | float | No | 0.7 | Sampling temperature (0-2) |

**Available Models:**

| Model ID | Provider | Description |
|----------|----------|-------------|
| `openai/gpt-4o` | OpenAI | Most capable GPT-4 with vision |
| `openai/gpt-4o-mini` | OpenAI | Fast and cost-effective |
| `anthropic/claude-sonnet-4` | Anthropic | Balanced for most tasks |
| `google/gemini-2.0-flash` | Google | Fast multimodal model |
| `deepseek/deepseek-chat` | DeepSeek | General-purpose chat |

**Example:**
```python
result = agentkit.execute_action("chat_completion", {
    "model": "anthropic/claude-sonnet-4",
    "prompt": "Explain quantum computing in simple terms",
    "system_prompt": "You are a physics teacher",
    "max_tokens": 500,
})
```

### `list_models`

List all available models with descriptions. No parameters required.

```python
result = agentkit.execute_action("list_models", {})
```

## Network Support

| Network | ID | Status |
|---------|----|----|
| Base Mainnet | `base-mainnet` | Production |
| Base Sepolia | `base-sepolia` | Testing |

Ensure your wallet has USDC on the appropriate network.

## Payment Details

- **Currency:** USDC on Base
- **Protocol:** x402 v2
- **Settlement:** Coinbase CDP Facilitator
- **Pricing:** Pay-per-token (~$0.001-$0.01 per typical request)

## Response Format

**Success:**
```json
{
  "success": true,
  "model": "openai/gpt-4o-mini",
  "response": "The capital of France is Paris.",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 8,
    "total_tokens": 18
  },
  "payment": "Paid via x402 micropayment on Base"
}
```

**Error:**
```json
{
  "error": true,
  "message": "BlockRun chat completion failed: ...",
  "suggestion": "Ensure your wallet has sufficient USDC on Base."
}
```

## Links

- [BlockRun Documentation](https://blockrun.ai/docs)
- [x402 Protocol](https://www.x402.org/)
- [Coinbase Developer Platform](https://docs.cdp.coinbase.com/)
