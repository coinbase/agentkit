# CDP Agentkit Strands Agents Extension Examples - Chatbot Python

This example demonstrates an agent setup as a terminal style chatbot with access to the full set of CDP Agentkit actions.

## Ask the chatbot to engage in the Web3 ecosystem!
- "What's my wallet address and balance?"
- "What is the price of BTC?"
- "Request some test tokens from the faucet"
- "Deploy an ERC-20 token with total supply 1 billion"

## Requirements
- Python 3.10+
- uv for package management and tooling
  - [uv Installation Instructions](https://github.com/astral-sh/uv?tab=readme-ov-file#installation)
- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- Amazon Bedrock Models
    - [Configure AWS Credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html) OR use [Amazon Bedrock API keys](https://docs.aws.amazon.com/bedrock/latest/userguide/getting-started-api-keys.html) alternatively for Amazon Bedrock model access with Strands Agents.
    - [Set up Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/getting-started.html)
    > **_NOTE:_**  [Strands Agents](https://strandsagents.com/latest/) is model provider agnostic

### Checking Python Version
Before using the example, ensure that you have the correct version of Python installed. The example requires Python 3.10 or higher. You can check your Python version by running:

```bash
python --version
uv --version
```

## Installation
```bash
uv sync
```

## Run the Chatbot

### Set ENV Vars
- Ensure the following ENV Vars are set:
  - "CDP_API_KEY_ID"
  - "CDP_API_KEY_SECRET"
  - "CDP_WALLET_SECRET"
  - "AWS_ACCESS_KEY_ID"
  - "AWS_SECRET_ACCESS_KEY"
  - "AWS_REGION"
  - "NETWORK_ID" (Defaults to `base-sepolia`)

⚠ **Note**: If using Bedrock API keys instead of AWS credentials, set `AWS_BEARER_TOKEN_BEDROCK` instead of `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as environment variable for Bedrock model access. Also make sure the `AWS_REGION` aligns with the AWS region the Bedrock access key was created in.

```bash
uv run chatbot.py
```

---

To run example using `pip` package installer:

```bash
python --version
pip --version
```

## Installation
```bash
pip install coinbase-agentkit coinbase-agentkit-strands-agents
```

## Run the Chatbot

### Set ENV Vars
- Ensure the following ENV Vars are set:
  - "CDP_API_KEY_ID"
  - "CDP_API_KEY_SECRET"
  - "CDP_WALLET_SECRET"
  - "AWS_ACCESS_KEY_ID"
  - "AWS_SECRET_ACCESS_KEY"
  - "AWS_REGION"
  - "NETWORK_ID" (Defaults to `base-sepolia`)

⚠ **Note**: If using Bedrock API keys instead of AWS credentials, set `AWS_BEARER_TOKEN_BEDROCK` instead of `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as environment variable for Bedrock model access. Also make sure the `AWS_REGION` aligns with the AWS region the Bedrock access key was created in.

```bash
python chatbot.py
```