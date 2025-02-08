# Groq Integration Guide

## Prerequisites
- Python 3.8+
- CDP SDK: `pip install cdp-sdk`
- Groq Package: `pip install langchain-groq`

## Configuration
1. Get Groq API key from [Groq Console](https://console.groq.com)
2. Set environment variables:
```bash
export GROQ_API_KEY="your-api-key"
export CDP_MODEL_PROVIDER="groq"
export CDP_MODEL_NAME="mixtral-8x7b-32768"  # Example Groq model
```

## Basic Usage
```python
from cdp_langchain.utils import CdpAgentkitWrapper
from cdp_langchain.agent_toolkits import GroqToolkit

# Initialize with Groq
cdp = CdpAgentkitWrapper(
    provider="groq",
    model_name="mixtral-8x7b-32768"
)

toolkit = GroqToolkit.from_cdp_agentkit_wrapper(cdp)
```

## Advanced Features
### Streaming Responses
```python
from langchain_groq import ChatGroq

llm = ChatGroq(model="mixtral-8x7b-32768")
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
| MissingGroqAPIKey | Set GROQ_API_KEY environment var |
| InvalidModelName | Verify model name is correct (e.g., "mixtral-8x7b-32768") | 
| ProviderMismatch | Ensure provider="groq" in CdpAgentkitWrapper |

[Full Groq Documentation](https://console.groq.com/docs)
