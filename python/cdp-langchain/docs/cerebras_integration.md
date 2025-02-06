# Cerebras Integration Guide

## Prerequisites
- Python 3.8+
- CDP SDK: `pip install cdp-sdk`
- Cerebras Package: `pip install langchain-cerebras`

## Configuration
1. Get Cerebras API key from [Cerebras Cloud](https://cloud.cerebras.ai)
2. Set environment variables:
```bash
export CEREBRAS_API_KEY="your-api-key"
export CDP_MODEL_PROVIDER="cerebras"
export CDP_MODEL_NAME="llama-3.3-70b"  # Example Cerebras model
```

## Basic Usage
```python
from cdp_langchain.utils import CdpAgentkitWrapper
from cdp_langchain.agent_toolkits import CdpToolkit

# Initialize with Cerebras
cdp = CdpAgentkitWrapper(
    provider="cerebras",
    model_name="llama-3.3-70b"
)

toolkit = CdpToolkit.from_cdp_agentkit_wrapper(cdp)
```

## Advanced Features
### Streaming Responses
```python
from langchain_cerebras import ChatCerebras

llm = ChatCerebras(model="llama-3.3-70b")
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
| MissingCerebrasAPIKey | Set CEREBRAS_API_KEY environment var |
| InvalidModelName | Verify model at [Cerebras Model Hub](https://models.cerebras.ai) | 
| ProviderMismatch | Ensure provider="cerebras" in CdpAgentkitWrapper |

[Full Cerebras Documentation](https://docs.cerebras.net)
