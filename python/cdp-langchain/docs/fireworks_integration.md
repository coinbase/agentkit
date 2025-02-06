# Fireworks Integration Guide

## Prerequisites
- Python 3.8+
- CDP SDK: `pip install cdp-sdk`
- Fireworks Package: `pip install langchain-fireworks`

## Configuration
1. Get Fireworks API key from [Fireworks Dashboard](https://fireworks.ai)
2. Set environment variables:
```bash
export FIREWORKS_API_KEY="your-api-key"
export CDP_MODEL_PROVIDER="fireworks"
export CDP_MODEL_NAME="accounts/fireworks/models/llama-v2-7b"  # Example Fireworks model
```

## Basic Usage
```python
from cdp_langchain.utils import CdpAgentkitWrapper
from cdp_langchain.agent_toolkits import FireworksToolkit

# Initialize with Fireworks
cdp = CdpAgentkitWrapper(
    provider="fireworks",
    model_name="accounts/fireworks/models/llama-v2-7b"
)

toolkit = FireworksToolkit.from_cdp_agentkit_wrapper(cdp)
```

## Advanced Features
### Streaming Responses
```python
from langchain_fireworks import ChatFireworks

llm = ChatFireworks(model="accounts/fireworks/models/llama-v2-7b")
agent = create_react_agent(llm, toolkit.get_tools())

for chunk in agent.stream({"messages": [("user", "Explain my transactions")]}):
    print(chunk.content, end="", flush=True)
```

### Async Operations
```python
async for chunk in agent.astream({
    "messages": [("user", "Analyze NFT holdings")]
}):
    print(chunk.content, end="", flush=True)
```

## Troubleshooting
| Error | Solution |
|-------|----------|
| MissingFireworksAPIKey | Set FIREWORKS_API_KEY environment var |
| InvalidModelName | Verify model at [Fireworks Model Catalog](https://app.fireworks.ai) | 
| ProviderMismatch | Ensure provider="fireworks" in CdpAgentkitWrapper |

[Full Fireworks Documentation](https://docs.fireworks.ai)
