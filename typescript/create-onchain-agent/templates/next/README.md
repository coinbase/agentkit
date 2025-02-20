# AgentKit Project

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-onchain-agent`]().  
It integrates [AgentKit](https://github.com/coinbase/agentkit) to provide AI-driven interactions with on-chain capabilities.


## Getting Started

First, install dependencies:

`npm install`

Next, run the development server:

`npm run dev`

Open [http://localhost:3000](http://localhost:3000) in your browser to see the project.


## Configuring Your Agent

You can modify your configuration of the agent. By default, your agent configuration occurs in the `/api/agent/route.ts` file.

### 1. Select Your LLM  
Modify the `ChatOpenAI` instantiation to use the model of your choice.  
For OpenAI models, refer to: [OpenAI Model Documentation](https://platform.openai.com/docs/models)

### 2. Select Your WalletProvider  
AgentKit requires a **WalletProvider** to interact with blockchain networks.

- Documentation: [Wallet Providers](https://github.com/coinbase/agentkit/tree/main/typescript/agentkit#evm-wallet-providers)

### 3. Select Your ActionProviders  
ActionProviders define what your agent can do. You can use built-in providers or create your own.

- Built-in ActionProviders: [Available Providers](https://github.com/coinbase/agentkit/tree/main/typescript/agentkit#action-providers)
- Custom ActionProviders: [Creating a Provider](https://github.com/coinbase/agentkit/tree/main/typescript/agentkit#creating-an-action-provider)

---

## Next Steps

- Explore the AgentKit README: [AgentKit Documentation](https://github.com/coinbase/agentkit)
- Learn more about available WalletProviders & ActionProviders.
- Experiment with custom ActionProviders for your specific use case.

---

## Learn More

- [Learn more about CDP](https://docs.cdp.coinbase.com/)
- [Learn more about AgentKit](https://docs.cdp.coinbase.com/agentkit/docs/welcome)
- [Learn more about Next.js](https://nextjs.org/docs)
- [Learn more about Tailwind CSS](https://tailwindcss.com/docs)

---

## Contributing

Interested in contributing to AgentKit? Follow the contribution guide:

- [Contribution Guide](https://github.com/coinbase/agentkit/blob/main/CONTRIBUTING.md)
- Join the discussion on [Discord](https://discord.gg/CDP)
