# Farcaster Langchain Toolkit
Farcaster integration with Langchain to enable agentic workflows using the core primitives defined in `cdp-agentkit-core`.

This toolkit contains tools that enable an LLM agent to interact with [Farcaster](https://www.farcaster.xyz/) via the [Neynar API](https://docs.neynar.com/). The toolkit provides a wrapper around the Neynar API, allowing agents to perform social operations like posting casts and replies.

## Setup

### Prerequisites
- Python 3.10 or higher 
- [OpenAI API Key](https://platform.openai.com/api-keys)
- [Neynar API Key](https://docs.neynar.com/reference/getting-started)
- [Neynar Signer UUID](https://docs.neynar.com/reference/create-signer)
- Farcaster Account with FID

### Installation

```bash
pip install farcaster-langchain
```

### Environment Setup

Set the following environment variables:

```bash
export OPENAI_API_KEY=<your-openai-api-key>
export NEYNAR_API_KEY=<your-neynar-api-key>
export NEYNAR_SIGNER_UUID=<your-signer-uuid>
export FARCASTER_FID=<your-farcaster-id>
```

## Usage

### Basic Setup

```python
from farcaster_langchain import (
    FarcasterApiWrapper,
    FarcasterToolkit
)

# Initialize FarcasterApiWrapper
farcaster_api_wrapper = FarcasterApiWrapper()

# Create FarcasterToolkit from the api wrapper
farcaster_toolkit = FarcasterToolkit.from_farcaster_api_wrapper(farcaster_api_wrapper)
```

View available tools:
```python
tools = farcaster_toolkit.get_tools()
for tool in tools:
    print(tool.name)
```

The toolkit provides the following tools:

1. **user_details** - Get user details by FID
2. **user_notifications** - Get notifications for the authenticated user
3. **cast** - Post a cast (max 320 characters, with optional channel and embeds)
4. **reply_to_cast** - Reply to an existing cast

### Using with an Agent

```python
import uuid

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from langgraph.prebuilt import create_react_agent

llm = ChatOpenAI(model="gpt-4o-mini")

# Create agent
agent_executor = create_react_agent(llm, tools)

# Example - post cast
events = agent_executor.stream(
    {
        "messages": [
            HumanMessage(content=f"Please post 'Hello Farcaster! {uuid.uuid4().hex}' to Farcaster"),
        ],
    },
    stream_mode="values",
)

for event in events:
    event["messages"][-1].pretty_print()
```

Expected output:
```
================================ Human Message =================================
Please post 'Hello Farcaster! c4b8e3744c2e4345be9e0622b4c0a8aa' to Farcaster
================================== Ai Message ==================================
Tool Calls:
    cast (call_xVx4BMCSlCmCcbEQG1yyebbq)
    Call ID: call_xVx4BMCSlCmCcbEQG1yyebbq
    Args:
        text: Hello Farcaster! c4b8e3744c2e4345be9e0622b4c0a8aa
================================= Tool Message =================================
Name: cast
Successfully posted!
================================== Ai Message ==================================
The message "Hello Farcaster! c4b8e3744c2e4345be9e0622b4c0a8aa" has been successfully posted to Farcaster!
```

### Advanced Usage

You can also specify a channel or include embeds when posting:

```python
# Post in a specific channel
response = farcaster_api_wrapper.cast(
    text="Hello Python developers! 🐍", 
    channel_id="python"
)

# Post with an embedded URL
response = farcaster_api_wrapper.cast(
    text="Check out this cool project!", 
    embeds=["https://github.com/example/project"]
)
```

## Contributing
See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed setup instructions and contribution guidelines.

## Documentation
For detailed documentation, please visit:
- [Agentkit-Core](https://coinbase.github.io/cdp-agentkit/cdp-agentkit-core/)
- [Neynar API Documentation](https://docs.neynar.com/) 