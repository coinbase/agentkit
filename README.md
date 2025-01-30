<div align="center">
  <p>
    <a href="https://docs.cdp.coinbase.com/agentkit/docs/welcome">
      <img src="./agentkit_banner.png"/>
    </a>
  </p>
  <h1 style="font-size: 3em; margin-bottom: 20px;">
    AgentKit
  </h1>

  <p style="font-size: 1.2em; max-width: 600px; margin: 0 auto 20px;">
    Every agent deserves a wallet!
  </p>

[![PyPI - Downloads](https://img.shields.io/pypi/dm/cdp-agentkit-core?style=flat-square)](https://pypistats.org/packages/cdp-agentkit-core)
[![npm downloads](https://img.shields.io/npm/dm/@coinbase/cdp-agentkit-core?style=flat-square)](https://www.npmjs.com/package/@coinbase/cdp-agentkit-core)
[![GitHub star chart](https://img.shields.io/github/stars/coinbase/cdp-agentkit?style=flat-square)](https://star-history.com/#coinbase/cdp-agentkit)
[![Open Issues](https://img.shields.io/github/issues-raw/coinbase/cdp-agentkit?style=flat-square)](https://github.com/coinbase/cdp-agentkit/issues)

</div>

## Overview

AgentKit is [Coinbase Developer Platform's](https://docs.cdp.coinbase.com) framework for easily enabling AI agents to take actions onchain. It is designed to be framework-agnostic, so you can use it with any AI framework, and wallet-agnostic, so you can use it with any wallet. AgentKit is actively being built out, and welcomes community contributions!

<div align="center">
  <a href="https://www.youtube.com/watch?v=-R_mKpdepRE">
    <img src="https://img.youtube.com/vi/-R_mKpdepRE/maxresdefault.jpg" alt="Video Title" style="max-width: 600px;">
  </a>
</div>

## Quickstart

### Python

*Prerequisites*:
- [Python 3.10+](https://www.python.org/downloads/)
- [Poetry](https://python-poetry.org/docs/)
- [CDP Secret API Key](https://docs.cdp.coinbase.com/get-started/docs/cdp-api-keys#creating-secret-api-keys)
- [OpenAI API Key](https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key)

1. Get your agent running:

```bash
# Clone the repository
git clone https://github.com/coinbase/agentkit.git

# Navigate to the chatbot-python example
cd agentkit/cdp-langchain/examples/chatbot-python

# At this point, fill in your CDP API key name, private key, and OpenAI API key in the
# .env.example file.
# Then, rename the .env.example file to .env
mv .env.example .env

# Install dependencies
poetry install

# Run the chatbot
make run
```
2. Select "1. chat mode" and start telling your Agent to do things onchain!

```bash
Prompt: Fund my wallet with some testnet ETH.
-------------------
Wallet: ccaf1dbf-3a90-4e52-ad34-89a07aad9e8b on network: base-sepolia with default address: 0xD9b990c7b0079c1c3733D2918Ee50b68f29FCFD5
-------------------

-------------------
Received eth from the faucet. Transaction: https://sepolia.basescan.org/tx/0x03e82934cd04be5b725927729b517c606f6f744611f0f36e834f21ad742ad7ca
-------------------
Your wallet has been successfully funded with testnet ETH. You can view the transaction [here](https://sepolia.basescan.org/tx/0x03e82934cd04be5b725927729b517c606f6f744611f0f36e834f21ad742ad7ca).
-------------------
```

### Node.js

*Prerequisites*:
- [Node.js 18+](https://nodejs.org/en/download/)
- [CDP Secret API Key](https://docs.cdp.coinbase.com/get-started/docs/cdp-api-keys#creating-secret-api-keys)
- [OpenAI API Key](https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key)

1. Get your agent running:

```bash
# Clone the repository
git clone https://github.com/coinbase/agentkit.git

# Navigate to the chatbot-typescript example
cd agentkit/cdp-langchain/examples/chatbot-typescript

# At this point, fill in your CDP API key name, private key, and OpenAI API key in
# the .env.example file.
# Then, rename the .env.example file to .env
mv .env.example .env

# Install dependencies
npm install

# Run the chatbot
npm run start
```
2. Select "1. chat mode" and start telling your Agent to do things onchain!

```bash
Prompt: Fund my wallet with some testnet ETH.
-------------------
Wallet: ccaf1dbf-3a90-4e52-ad34-89a07aad9e8b on network: base-sepolia with default address: 0xD9b990c7b0079c1c3733D2918Ee50b68f29FCFD5
-------------------

-------------------
Received eth from the faucet. Transaction: https://sepolia.basescan.org/tx/0x03e82934cd04be5b725927729b517c606f6f744611f0f36e834f21ad742ad7ca
-------------------
Your wallet has been successfully funded with testnet ETH. You can view the transaction [here](https://sepolia.basescan.org/tx/0x03e82934cd04be5b725927729b517c606f6f744611f0f36e834f21ad742ad7ca).
-------------------
```

## Repository Structure

AgentKit is organized as a [monorepo](https://en.wikipedia.org/wiki/Monorepo) that contains multiple packages.

```
./
├── cdp-agentkit-core/
│   ├── python/
│   └── typescript/
├── cdp-langchain/
│   ├── python/
│   ├── typescript/
│   └── examples/
└── farcaster-langchain/
    ├── typescript/
    └── examples/
└── twitter-langchain/
    ├── python/
    ├── typescript/
    └── examples/
```

### cdp-agentkit-core

Core primitives and framework-agnostic tools that are meant to be composable and used via AgentKit framework extensions (ie, `cdp-langchain`).
See [CDP Agentkit Core](./cdp-agentkit-core/README.md) to get started!

### cdp-langchain

Langchain Toolkit extension of AgentKit. Enables agentic workflows to interact with onchain actions.
See [CDP Langchain](./cdp-langchain/README.md) to get started!

### farcaster-langchain

Langchain Toolkit extension for Farcaster. Enables agentic workflows to interact with Farcaster, such as to post a tweet.
See [Farcaster Langchain](./farcaster-langchain/typescript/README.md) to get started!

### twitter-langchain

Langchain Toolkit extension for Twitter. Enables agentic workflows to interact with Twitter, such as to post a tweet.
See [Twitter Langchain](./twitter-langchain/README.md) to get started!

## Contributing

AgentKit welcomes community contributions.
See [CONTRIBUTING.md](./CONTRIBUTING.md) for more information.

## Documentation

- [AgentKit Documentation](https://docs.cdp.coinbase.com/agentkit/docs/welcome)
- [API Reference: AgentKit Core Python](https://coinbase.github.io/agentkit/cdp-agentkit-core/python/index.html)
- [API Reference: AgentKit LangChain Extension Python](https://coinbase.github.io/agentkit/cdp-langchain/python/index.html)
- [API Reference: AgentKit Core Node.js](https://coinbase.github.io/agentkit/cdp-agentkit-core/typescript/index.html)
- [API Reference: AgentKit LangChain Extension Node.js](https://coinbase.github.io/agentkit/cdp-langchain/typescript/index.html)

## Security and bug reports

The AgentKit team takes security seriously.
See [SECURITY.md](SECURITY.md) for more information.

## License

Apache-2.0
