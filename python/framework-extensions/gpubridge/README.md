# coinbase-agentkit-gpubridge

GPU-Bridge action provider for [Coinbase AgentKit](https://github.com/coinbase/agentkit).

Gives your AgentKit agents access to 30 GPU-powered AI services via GPU-Bridge.

## Install

```bash
pip install coinbase-agentkit-gpubridge
```

## Usage

```python
from coinbase_agentkit import AgentKit, AgentKitConfig
from coinbase_agentkit_gpubridge import gpu_bridge_action_provider

agent_kit = AgentKit(AgentKitConfig(
    wallet_provider=...,
    action_providers=[
        gpu_bridge_action_provider(api_key="gpub_..."),
    ]
))

# With LangChain
from coinbase_agentkit_langchain import get_langchain_tools
tools = get_langchain_tools(agent_kit)
# tools now includes: gpu_bridge_llm, gpu_bridge_image, gpu_bridge_embed, gpu_bridge_transcribe
```

## Actions

| Action | Description |
|--------|-------------|
| `gpu_bridge_llm` | LLM inference (Llama 70B) |
| `gpu_bridge_image` | Image generation (FLUX/SD) |
| `gpu_bridge_embed` | Text embeddings |
| `gpu_bridge_transcribe` | Audio → text (Whisper) |

## x402 mode

Leave `api_key` unset to use x402 autonomous payments (USDC on Base L2).

## Links

- GPU-Bridge: https://gpubridge.xyz
- Catalog: https://api.gpubridge.xyz/catalog
