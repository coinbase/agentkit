# Autonomous AI Advertising Agent with Crypto Payments Example - Chatbot Python

An AI agent that creates complete advertising campaigns while autonomously paying for premium services using cryptocurrency via the X402 payment protocol.

## Overview

### Architecture

The sample demonstrates integration between multiple systems:
- **Strands AI Framework** → Agent reasoning and tool orchestration
- **Coinbase AgentKit** → Blockchain wallet and transaction management  
- **X402 Protocol** → HTTP-based micropayment standard for API access
- **External APIs** → Payment-gated image generation and weather services

### Key Features

- **Economic Agency**: AI agent manages its own budget and purchases services autonomously
- **Crypto-Native Payments**: Uses USDC on Base Sepolia testnet for service payments
- **Multi-Service Integration**: Combines weather data and AI image generation for enhanced campaigns
- **Complete Campaign Generation**: Produces ready-to-deploy HTML advertising assets

## Prerequisites

- Python **3.10+**
- [uv](https://docs.astral.sh/uv/getting-started/installation/) for dependency management
- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- [OpenWeather API key](https://openweathermap.org/guide)
- Amazon Bedrock Models access enabled for Claude Sonnet 4
    - [Configure AWS Credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html) OR use [Amazon Bedrock API keys](https://docs.aws.amazon.com/bedrock/latest/userguide/getting-started-api-keys.html) alternatively for Amazon Bedrock model access with Strands Agents.
    - [Set up Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/getting-started.html)
    > **_NOTE:_**  [Strands Agents](https://strandsagents.com/latest/) is model provider agnostic

## Setup

1. **Configure environment variables:**
   ```bash
   cp .env.local .env
   # Edit .env with your configuration:
   # - CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET (Coinbase testnet)
   # - ADDRESS (Base Sepolia testnet receiving address)
   # - OPENWEATHER_API_KEY
   # - AWS_ACCESS_KEY_ID
   # - AWS_SECRET_ACCESS_KEY
   # - AWS_REGION
   ```
   ⚠ **Note**: If using Bedrock API keys instead of AWS credentials, set `AWS_BEARER_TOKEN_BEDROCK` instead of `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as environment variable for Bedrock model access. Also make sure the `AWS_REGION` aligns with the AWS region the Bedrock access key was created in.

2. **Installation:**
   ```bash
   uv sync
   ```

3. **Start the payment server on a seperate terminal:**
   ```bash
   uv run paid_server.py
   ```

## Usage

**Run the advertising agent on a new terminal:**
```bash
uv run chatbot.py
```

## Ask the chatbot to engage in the Web3 ecosystem!

**Example interaction:**
- "Generate an ad for ice cream shop promotion in Miami for social-media platform"
- "generate a short ad for smat watches for elderly perople on instagram"

## Example Output

The agent produces:
- Weather-responsive ad copy based on real-time conditions
- AI-generated imagery for campaigns  
- Complete HTML files with embedded visuals
- Multi-platform advertising assets (social media, display, email)

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| API key errors | Missing environment variables | Verify all required keys in `.env` |
| Image generation fails | Payment server not running | Start `paid_server.py` first |

---