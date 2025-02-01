# Twitter (X) LangChain Toolkit

LangChain extension of AgentKit. Enables agentic workflows to interact with Twitter, such as to post a tweet.

This toolkit contains tools that enable an LLM agent to interact with [Twitter](https://developer.x.com/en/docs/x-api). The toolkit provides a wrapper around the Twitter (X) API, allowing agents to perform social operations like posting text.

## Setup

### Prerequisites

- [OpenAI API Key](https://platform.openai.com/api-keys)
- [Twitter (X) App Developer Keys](https://developer.x.com/en/portal/dashboard)
- Python 3.10 or higher

### Installation

```bash
pip install twitter-langchain
```

### Environment Setup

Set the following environment variables:

```bash
export OPENAI_API_KEY=<your-openai-api-key>
export TWITTER_API_KEY=<your-api-key>
export TWITTER_API_SECRET=<your-api-secret>
export TWITTER_ACCESS_TOKEN=<your-access-token>
export TWITTER_ACCESS_TOKEN_SECRET=<your-access-token-secret>
export TWITTER_BEARER_TOKEN=<your-bearer-token>
```

## Usage

### Basic Setup

```python
from twitter_langchain import (
    TwitterApiWrapper,
    TwitterToolkit
)

# Initialize TwitterApiwrapper
twitter_api_wrapper = TwitterApiWrapper()

# Create TwitterToolkit from the api wrapper
twitter_toolkit = TwitterToolkit.from_twitter_api_wrapper(twitter_api_wrapper)
```

View available tools:
```python
tools = twitter_toolkit.get_tools()
for tool in tools:
    print(tool.name)
```

### Available Tools

The toolkit provides the following tools:

1. **account_details** - Get the authenticated account details
2. **account_mentions** - Get mentions for the account
3. **post_tweet** - Post a tweet to the account
3. **post_tweet_reply** - Post a reply to a tweet on Twitter

### Using with an Agent

```python
import uuid

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage
from langgraph.prebuilt import create_react_agent

llm = ChatOpenAI(model="gpt-4o-mini")

# Create agent
agent_executor = create_react_agent(llm, tools)

# Example - post tweet
events = agent_executor.stream(
    {
        "messages": [
            HumanMessage(content=f"Please post 'hello, world! {uuid.uuid4().hex}' to twitter"),
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
Please post 'hello, world! c4b8e3744c2e4345be9e0622b4c0a8aa' to twitter
================================== Ai Message ==================================
Tool Calls:
    post_tweet (call_xVx4BMCSlCmCcbEQG1yyebbq)
    Call ID: call_xVx4BMCSlCmCcbEQG1yyebbq
    Args:
        tweet: hello, world! c4b8e3744c2e4345be9e0622b4c0a8aa
================================= Tool Message =================================
Name: post_tweet
Successfully posted!
================================== Ai Message ==================================
The message "hello, world! c4b8e3744c2e4345be9e0622b4c0a8aa" has been successfully posted to Twitter!
```

## Examples

Check out [../examples](../examples) for inspiration and help getting started!
- [Chatbot Python](../examples/twitter-langchain-chatbot/README.md): Simple example of a Python Chatbot that can interact on Twitter (X), using OpenAI.

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for detailed setup instructions and contribution guidelines.
