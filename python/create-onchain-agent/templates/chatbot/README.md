# AgentKit Chatbot

This is a Python chatbot project bootstrapped with [`create-onchain-agent`]().  
It integrates [AgentKit](https://github.com/coinbase/agentkit) to provide AI-driven interactions with on-chain capabilities.

## Getting Started

First, install dependencies:

`poetry install`

Next, run the chatbot:

`poetry run python chatbot.py`

## Configuring Your Agent

You can modify your agent configuration in the `chatbot.py` file.

### 1. Select Your LLM  
Modify the `ChatOpenAI` instantiation to use the model of your choice.  
For OpenAI models, refer to: [OpenAI Model Documentation](https://platform.openai.com/docs/models)

### 2. Select Your WalletProvider  
AgentKit requires a **WalletProvider** to interact with blockchain networks.

- Documentation: [Wallet Providers](https://github.com/coinbase/agentkit/tree/main/python/coinbase-agentkit#wallet-providers)

### 3. Select Your ActionProviders  
ActionProviders define what your agent can do. You can use built-in providers or create your own.

- Built-in ActionProviders: [Available Providers](https://github.com/coinbase/agentkit/tree/main/python/coinbase-agentkit#create-an-agentkit-instance-with-specified-action-providers)
- Custom ActionProviders: [Creating a Provider](https://github.com/coinbase/agentkit/tree/main/python/coinbase-agentkit#creating-an-action-provider)

## Next Steps

- Explore the AgentKit README: [AgentKit Documentation](https://github.com/coinbase/agentkit)
- Learn more about available WalletProviders & ActionProviders.
- Experiment with custom ActionProviders for your specific use case.

## Learn More

- [Learn more about CDP](https://docs.cdp.coinbase.com/)
- [Learn more about AgentKit](https://docs.cdp.coinbase.com/agentkit/docs/welcome)

## Contributing

Interested in contributing to AgentKit? Follow the contribution guide:

- [Contribution Guide](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING.md)
- Join the discussion on [Discord](https://discord.gg/CDP)
