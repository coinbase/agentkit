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
    Every agent deserves a wallet.
  </p>

[![](https://github.com/coinbase/agentkit/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/coinbase/agentkit/actions/workflows/github-code-scanning/codeql)
[![pypi downloads](https://img.shields.io/pypi/dm/coinbase-agentkit?label=pypi:coinbase-agentkit&style=flat-square)](https://pypistats.org/packages/coinbase-agentkit)
[![npm downloads](https://img.shields.io/npm/dm/@coinbase/agentkit?label=npm:@coinbase/agentkit&style=flat-square)](https://www.npmjs.com/package/@coinbase/agentkit)
[![GitHub star chart](https://img.shields.io/github/stars/coinbase/agentkit?style=flat-square)](https://star-history.com/#coinbase/agentkit)
[![Open Issues](https://img.shields.io/github/issues-raw/coinbase/agentkit?style=flat-square)](https://github.com/coinbase/agentkit/issues)

</div>

## Table of Contents

- [📖 Overview](#-overview)
- [🚀 Quickstart](#-quickstart)
  - [Node.js](#nodejs)
  - [Python](#python)
- [🗂 Repository Structure](#-repository-structure)
- [🤝 Contributing](#-contributing)
- [📜 Documentation](#-documentation)
- [🌙 Nightly Builds](#-nightly-builds)
- [🚨 Security and bug reports](#-security-and-bug-reports)
- [📧 Contact](#-contact)
- [🔗 Supported Wallets, Protocols, and Frameworks](#-supported-wallets-protocols-and-frameworks)
- [📝 License](#-license)
- [🔒 Legal and Privacy](#-legal-and-privacy)

## 📖 Overview

AgentKit is [Coinbase Developer Platform's](https://docs.cdp.coinbase.com) toolkit for giving AI agents a crypto wallet and onchain interactions. It is designed to be framework-agnostic, so you can use it with any AI framework, and wallet-agnostic, so you can use it with any wallet. With AgentKit, you can enable fee-free stablecoin payments and monetize your AI agents seamlessly. AgentKit is actively being built out, and [welcomes community contributions!](#-contributing)

<div align="center">
  <a href="https://youtu.be/hw-PuogqLR0">
    <img src="https://img.youtube.com/vi/hw-PuogqLR0/maxresdefault.jpg" alt="Video Title" style="max-width: 600px;">
  <p align="center">
    Watch our welcome guide above to understand what AgentKit is, learn how to navigate this repository, and get started building your first onchain AI agent.
  </p>
  </a>
</div>

## 🚀 Quickstart

### Node.js

_Prerequisites_:

- [Node.js 18+](https://nodejs.org/en/download/)
- [CDP Secret API Key](https://docs.cdp.coinbase.com/get-started/docs/cdp-api-keys#creating-secret-api-keys)
- [OpenAI API Key](https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key)

1. Get your agent running:

```bash
# Create a new fullstack agent project
npm create onchain-agent@latest

# Navigate to your project directory
cd onchain-agent

# At this point, fill in your CDP API key id/secret, OpenAI API key, and any other environment variables in the .env.local file.
# Then, rename the .env.local file to .env
mv .env.local .env

# Install dependencies
npm install

# Run the development server
npm run dev
```

2. Visit `http://localhost:3000` in your browser and start telling your Agent to do things onchain!

```bash
User: Fund my wallet with some testnet ETH.
Agent: Your wallet has been successfully funded with testnet ETH. You can view the transaction [here](https://sepolia.basescan.org/tx/0x03e82934cd04be5b725927729b517c606f6f744611f0f36e834f21ad742ad7ca)
```

### Python

_Prerequisites_:

- [Python 3.10+](https://www.python.org/downloads/)
- [Poetry](https://python-poetry.org/docs/)
- [CDP Secret API Key](https://docs.cdp.coinbase.com/get-started/docs/cdp-api-keys#creating-secret-api-keys)
- [OpenAI API Key](https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key)

1. Get your agent running:

```bash
# Create a new agent chatbot
pipx run create-onchain-agent

# Navigate to your project directory
cd onchain-agent

# At this point, fill in your CDP API key id/secret, OpenAI API key, and any other environment variables in the .env.local file.
# Then, rename the .env.local file to .env
mv .env.local .env

# Install dependencies
poetry install

# Run the chatbot
poetry run python chatbot.py
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

## 🗂 Repository Structure

AgentKit is organized as two monorepos, one for Python and one for Typescript, each containing multiple packages.

```
agentkit/
├── typescript/
│   ├── agentkit/
│   │   └── src/
│   │       ├── action-providers/ # find 50+ actions in here
│   │       └── wallet-providers/
│   │           ├── cdp/
│   │           ├── privy/
│   │           └── viem/
│   │       └── scripts/generate-action-provider/ # use this to create new actions
│   ├── create-onchain-agent/
│   ├── framework-extensions/
│   │   ├── langchain/
│   │   ├── vercel-ai-sdk/
│   │   └── model-context-protocol/
│   └── examples/
│       ├── langchain-cdp-chatbot/
│       ├── langchain-cdp-v2-chatbot/
│       ├── langchain-farcaster-chatbot/
│       ├── langchain-privy-chatbot/
│       ├── langchain-solana-chatbot/
│       ├── langchain-twitter-chatbot/
│       ├── langchain-xmtp-chatbot/
│       ├── model-context-protocol-smart-wallet-server/
│       └── vercel-ai-sdk-smart-wallet-chatbot/
├── python/
│   ├── coinbase-agentkit/
│   │   └── coinbase_agentkit/
│   │       ├── action_providers/  # find 30+ actions in here
│   │       └── wallet_providers/
│   │           ├── cdp/
│   │           ├── privy/
│   │           └── viem/
│   ├── create-onchain-agent/
│   ├── framework-extensions/
│   │   ├── langchain/
│   │   └── openai-agents-sdk/
│   └── examples/
│       ├── langchain-cdp-server-chatbot/
│       ├── langchain-cdp-smart-wallet-chatbot/
│       ├── langchain-eth-account-chatbot/
│       ├── langchain-nillion-secretvault-chatbot/
│       ├── langchain-twitter-chatbot/
│       ├── openai-agents-sdk-cdp-chatbot/
│       ├── openai-agents-sdk-cdp-voice-chatbot/
│       └── openai-agents-sdk-smart-wallet-chatbot/
```

## 🤝 Contributing

**AgentKit is actively looking for community contributions!**

- To see a list of actions and frameworks we'd love to see open-source contributions for, see [WISHLIST.md](./WISHLIST.md).
- To understand the process for contributing to AgentKit, see [CONTRIBUTING.md](./CONTRIBUTING.md).

## 📜 Documentation

- [AgentKit Documentation](https://docs.cdp.coinbase.com/agentkit/docs/welcome)
- Python API References
  - [AgentKit](https://coinbase.github.io/agentkit/coinbase-agentkit/python/index.html)
  - [AgentKit Langchain Extension](https://coinbase.github.io/agentkit/coinbase-agentkit-langchain/python/index.html)
- Node.js API References
  - [AgentKit](https://coinbase.github.io/agentkit/agentkit/typescript/index.html)
  - [AgentKit Langchain Extension](https://coinbase.github.io/agentkit/agentkit-langchain/typescript/index.html)
  - [AgentKit Vercel AI SDK Extension](https://coinbase.github.io/agentkit/agentkit-vercel-ai-sdk/typescript/index.html)
  - [AgentKit Model Context Protocol Extension](https://coinbase.github.io/agentkit/agentkit-model-context-protocol/typescript/index.html)

## 🌙 Nightly Builds

To access the bleeding edge version of AgentKit, you can install the nightly build for your language. This is a build of the latest code in the `main` branch, and is updated nightly.

### Typescript

You can install the latest nightly build with the following command:

```bash
npm install @coinbase/agentkit@nightly @coinbase/agentkit-langchain@nightly
```

If you're using an AI framework other than Langchain, make sure to install the corresponding package instead of `@coinbase/agentkit-langchain`.

To install a specific version of the nightly build, you can specify the exact version. For example, if you want to install the nightly build from February 20th, 2025, you can run the following:

```bash
npm install @coinbase/agentkit@0.2.3-nightly.20250220.0 @coinbase/agentkit-langchain@0.2.3-nightly.20250220.0
```

### Python

You can install the latest nightly build with the following command:

```bash
pip install --pre coinbase-agentkit coinbase-agentkit-langchain

# or, using poetry
poetry add coinbase-agentkit coinbase-agentkit-langchain --allow-prereleases
```

If you're using an AI framework other than Langchain, make sure to install the corresponding package instead of `coinbase-agentkit-langchain`.

To install a specific version of the nightly build, you can specify the exact version. For example, if you want to install the nightly build from February 20th, 2025, you can run the following:

```bash
pip install coinbase-agentkit==0.1.2.dev20250220 coinbase-agentkit-langchain==0.1.1.dev20250220

# or, using poetry
poetry add coinbase-agentkit==0.1.2.dev20250220 coinbase-agentkit-langchain==0.1.1.dev20250220 --allow-prereleases
```

## 🚨 Security and Bug Reports

The AgentKit team takes security seriously.
See [SECURITY.md](SECURITY.md) for more information.

## 📧 Contact

For feature requests, feedback, or questions, please reach out to us via the
[Coinbase Developer Platform Discord](https://discord.com/channels/1220414409550336183/1304126107876069376).

## 🔗 Supported Wallets, Protocols, and Frameworks

AgentKit is proud to have support for the following protocols, frameworks, wallets and networks. For detailed documentation on supported providers, see:

- [Action Providers (TypeScript)](https://github.com/coinbase/agentkit/blob/main/typescript/agentkit/src/action-providers)
- [Action Providers (Python)](https://github.com/coinbase/agentkit/blob/main/python/coinbase-agentkit/coinbase_agentkit/action_providers)
- [Wallet Providers (TypeScript)](https://github.com/coinbase/agentkit/blob/main/typescript/agentkit/src/wallet-providers)
- [Wallet Providers (Python)](https://github.com/coinbase/agentkit/blob/main/python/coinbase-agentkit/coinbase_agentkit/wallet_providers)

### Wallets

<a href="https://coinbase.com" target="_blank"><img src="./assets/wallets/coinbase.svg" width="100" height="auto" alt="Coinbase"></a>
<a href="https://privy.io" target="_blank"><img src="./assets/wallets/privy.svg" width="100" height="auto" alt="Privy"></a>
<a href="https://viem.sh" target="_blank"><img src="./assets/wallets/viem.svg" width="100" height="auto" alt="ViEM"></a>

### Protocols

<a href="https://www.alchemy.com/" target="_blank"><img src="./assets/protocols/alchemy.svg" width="100" height="auto" alt="Alchemy"></a>
<a href="https://compound.finance/" target="_blank"><img src="./assets/protocols/compound.svg" width="100" height="auto" alt="Compound"></a>
<a href="https://defillama.com/" target="_blank"><img src="./assets/protocols/defillama.svg" width="100" height="auto" alt="DefiLlama"></a>
<a href="https://farcaster.xyz" target="_blank"><img src="./assets/protocols/farcaster.svg" width="100" height="auto" alt="Farcaster"></a>
<a href="https://jup.ag" target="_blank"><img src="./assets/protocols/jupiter.svg" width="100" height="auto" alt="Jupiter"></a>
<a href="https://hyperbolic.xyz/" target="_blank"><img src="./assets/protocols/hyperbolic.svg" width="100" height="auto" alt="Hyperbolic"></a>
<a href="https://www.moonwell.fi" target="_blank"><img src="./assets/protocols/moonwell.svg" width="100" height="auto" alt="Moonwell"></a>
<a href="https://app.morpho.org" target="_blank"><img src="./assets/protocols/morpho.svg" width="100" height="auto" alt="Morpho"></a>
<a href="https://pyth.network" target="_blank"><img src="./assets/protocols/pyth.svg" width="100" height="auto" alt="Pyth"></a>
<a href="https://opensea.io" target="_blank"><img src="./assets/protocols/opensea.svg" width="100" height="auto" alt="OpenSea"></a>
<a href="https://superfluid.org" target="_blank"><img src="./assets/protocols/superfluid.svg" width="100" height="auto" alt="Superfluid"></a>
<a href="https://zora.co" target="_blank"><img src="./assets/protocols/zora.svg" width="100" height="auto" alt="Zora"></a>
<a href="https://allora.network" target="_blank"><img src="./assets/protocols/allora.svg" width="100" height="auto" alt="Allora"></a>

### Frameworks

<a href="https://langchain.com" target="_blank"><img src="./assets/frameworks/langchain.svg" width="100" height="auto" alt="Langchain"></a>
<a href="https://www.elizaos.ai" target="_blank"><img src="./assets/frameworks/eliza.svg" width="100" height="auto" alt="Eliza"></a>
<a href="https://sdk.vercel.ai" target="_blank"><img src="./assets/frameworks/vercel.svg" width="100" height="auto" alt="Vercel AI SDK"></a>
<a href="https://modelcontextprotocol.io/" target="_blank"><img src="./assets/frameworks/modelcontextprotocol.svg" width="100" height="auto" alt="Model Context Protocol"></a>
<a href="https://platform.openai.com/docs/guides/agents-sdk" target="_blank"><img src="./assets/frameworks/openai.svg" width="100" height="auto" alt="Agents SDK"></a>

### Networks

<a href="https://base.org" target="_blank"><img src="./assets/networks/base.svg" width="100" height="auto" alt="Base"></a>
<a href="https://ethereum.org" target="_blank"><img src="./assets/networks/ethereum.svg" width="100" height="auto" alt="Ethereum"></a>
<a href="https://solana.com" target="_blank"><img src="./assets/networks/solana.svg" width="100" height="auto" alt="Solana"></a>


Note: We support all EVM and SVM networks, with deep protocol support for the above networks. Please don't hesitate to make contributions to add more support for your preferred networks.

## 📝 License

AgentKit is licensed under the [Apache-2.0](LICENSE.md) license.

## 🔒 Legal and Privacy

The AgentKit software is novel and experimental, and is therefore provided on an AS-IS basis. The software is intended to be used only for the purposes of assisting with designing blockchain transactions and enabling other API integrations using natural language inputs, and is not intended to provide (i) an offer, or solicitation of an offer, to invest in, or to buy or sell, any interests or shares, or to participate in any investment or trading strategy, (ii) accounting, legal, tax advice, investment recommendations or other professional advice or (iii) an official statement of Coinbase. Acts proposed or performed by an agent through AgentKit software are NOT acts of Coinbase. You should consult with a professional advisor before making any decisions based on the information provided by the software. You are not permitted to use the proceeds of loans or credit to purchase digital assets on or through coinbase.com, Coinbase's APIs, the Coinbase mobile application, or any other Coinbase website or product, including AgentKit. No representation or warranty is made, expressed or implied, with respect to the accuracy, completeness, reliability, security, or suitability of the software or to any information provided in connection with the software. The risk of loss through use of the software can be substantial, and you assume any and all risks of loss and liability. The software may produce output that is inaccurate, incorrect, unpredictable or undesirable, and it is the user’s exclusive responsibility to evaluate the output and the use-case and determine whether it is appropriate. The right to use the software is contingent on your agreement to the [CDP Terms of Service](https://www.coinbase.com/legal/developer-platform/terms-of-service) (except to the extent it conflicts with the Apache-2.0 license).
