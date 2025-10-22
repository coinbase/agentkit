# AgentKit Strands Agents Extension

Strands Agents extension of AgentKit. Enables agentic workflows to interact with onchain actions.

## Setup

### Prerequisites

- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- Amazon Bedrock Models
    - [Configure AWS Credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html) OR use [Amazon Bedrock API keys](https://docs.aws.amazon.com/bedrock/latest/userguide/getting-started-api-keys.html) alternatively for Amazon Bedrock model access with Strands Agents.
    - [Set up Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/getting-started.html)
      > **_NOTE:_**  [Strands Agents](https://strandsagents.com/latest/) is model provider agnostic

### Installation

```bash
pip install coinbase-agentkit coinbase-agentkit-strands-agents
```

### Environment Setup

Set the following environment variables:

```bash
export CDP_API_KEY_ID=<your-cdp-api-key-id>
export CDP_API_KEY_SECRET=<your-cdp-api-key-secret>
export CDP_WALLET_SECRET=<your-cdp-wallet-secret>
export AWS_ACCESS_KEY_ID=<your-aws-access-key-id>
export AWS_SECRET_ACCESS_KEY=<your-aws-secret-access-key>
export AWS_REGION=<your-aws-region>
```
⚠ **Note**: If using Bedrock API keys instead of AWS credentials, set `AWS_BEARER_TOKEN_BEDROCK` instead of `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as environment variable for Bedrock model access. Also make sure the `AWS_REGION` aligns with the AWS region the Bedrock access key was created in.

## Usage

### Basic Setup

```python
from coinbase_agentkit import AgentKit
from coinbase_agentkit_strands_agents import get_strands_tools
from strands.models import BedrockModel
from strands import Agent

agentKit = AgentKit()

tools = get_strands_tools(agentKit)

llm = BedrockModel(
    model_id="us.amazon.nova-pro-v1:0",
    region_name='us-east-1' ## set to the appropriate region with model access
)

agent = Agent(
    model=llm,
    tools=tools,
)
```

For AgentKit configuration options, see the [Coinbase Agentkit README](https://github.com/coinbase/agentkit/blob/master/python/coinbase-agentkit/README.md).

For Strands Agents configuration options, see the [Strands Agents Documentation](https://strandsagents.com/latest/).

For a full example, see the [chatbot example](https://github.com/coinbase/agentkit/blob/main/python/examples/strands-agents-cdp-server-chatbot/chatbot.py).

## Contributing

See [CONTRIBUTING.md](https://github.com/coinbase/agentkit/blob/master/CONTRIBUTING.md) for detailed setup instructions and contribution guidelines.
