# ZeroDev Wallet Provider with EVM Wallet Example

This example demonstrates an agent setup using the ZeroDevWalletProvider with a EVM wallet as the signer. It shows how to:

1. Initialize a Viem/PrivyEvm/CDP wallet provider
2. Use the EVM wallet as a signer for the ZeroDev wallet provider
3. Create an AgentKit instance with the ZeroDev wallet provider
4. Set up LangChain tools using the AgentKit instance
5. Create a LangChain agent that uses those tools
6. Run the agent in either chat mode or autonomous mode

## Ask the agent to engage in the Web3 ecosystem!

- "Transfer a portion of your ETH to a random address"
- "What is the price of BTC?"
- "Deploy an NFT that will go super viral!"
- "Deploy an ERC-20 token with total supply 1 billion"

## Prerequisites

### Checking Node Version

Before using the example, ensure that you have the correct version of Node.js installed. The example requires Node.js 18 or higher. You can check your Node version by running:

```bash
node --version
```

If you don't have the correct version, you can install it using [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install node
```

This will automatically install and use the latest version of Node.

### API Keys

You'll need the following API keys:
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key) - For the LLM
- [CDP API Key](https://portal.cdp.coinbase.com/access/api) - For the CDP wallet
- [ZeroDev Project ID](https://docs.zerodev.app/getting-started) - For the ZeroDev wallet provider

Once you have them, rename the `.env-local` file to `.env` and make sure you set the API keys to their corresponding environment variables:

- "OPENAI_API_KEY"
- "CDP_API_KEY_NAME"
- "CDP_API_KEY_PRIVATE_KEY"
- "ZERODEV_PROJECT_ID"

## Running the example

From the root directory, run:

```bash
npm install
npm run build
```

This will install the dependencies and build the packages locally. The example uses the local `@coinbase/agentkit` and `@coinbase/agentkit-langchain` packages. If you make changes to the packages, you can run `npm run build` from root again to rebuild the packages, and your changes will be reflected in the example.

Now from the `typescript/examples/langchain-zerodev-chatbot` directory, run:

```bash
npm install
npm start
```

Select "1. chat mode" and start telling your Agent to do things onchain!

## How it works

The example demonstrates how to use a EVM wallet provider as the signer for a ZeroDev wallet provider. This allows you to leverage the benefits of both wallet providers:

- CDP wallet provides secure key management through Coinbase's MPC infrastructure
- ZeroDev wallet provides account abstraction features like batched transactions, sponsored gas, and more

The key part of the example is the configuration of the ZeroDev wallet provider with the privateKey Privy CDP wallet as the signer:

```typescript
// Configure ZeroDev Wallet Provider with CDP Wallet as signer
const zeroDevConfig = {
  signer: evmWalletProvider.toSigner(),
  projectId: process.env.ZERODEV_PROJECT_ID!,
  entryPointVersion: "0.7" as const,
  // Use the same network as the CDP wallet
  networkId: process.env.NETWORK_ID || "base-mainnet",
};

// Initialize ZeroDev Wallet Provider
const zeroDevWalletProvider = await ZeroDevWalletProvider.configureWithWallet(zeroDevConfig);
```

The agent is then initialized with the ZeroDev wallet provider, allowing it to use ZeroDev's account abstraction features while still leveraging CDP's secure key management.

## License

Apache-2.0
