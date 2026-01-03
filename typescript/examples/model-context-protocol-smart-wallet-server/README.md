# CDP AgentKit Model Context Protocol Examples - Chatbot Typescript

This example demonstrates an agent setup as a server for Model Context Protocol, allowing Claude Desktop access to the full set of CDP AgentKit actions.

## Ask the chatbot to engage in the Web3 ecosystem!

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

You'll need the following API key:
- [CDP API Key](https://portal.cdp.coinbase.com/access/api)

You'll need to configure the Claude desktop config file with your CDP API keys. Copy the contents from `claude_desktop_config.json` to your Claude desktop config file and update the following:

1. Update the `args` path to match the location of your built index.js file
2. Set your CDP API keys in the `env` section:
   - "CDP_API_KEY_ID"
   - "CDP_API_KEY_SECRET"
   - "PRIVATE_KEY" (optional, will generate a new private key if not provided)
   - "SMART_WALLET_ADDRESS" (optional, will generate a new smart wallet address if not provided)

Then, navigate to the `claude_desktop_config.json` file found in your Claude Desktop apps' settings and update it's contents to the contents of our `claude_desktop_config.json` file.

## Running the example

From the root directory, run:

```bash
npm install
npm run build
```

This will install the dependencies and build the packages locally. The chatbot example uses the local `@coinbase/agentkit-model-context-protocol` and `@coinbase/agentkit` packages. If you make changes to the packages, you can run `npm run build` from root again to rebuild the packages, and your changes will be reflected in the chatbot example.

To use the chatbot, simply open Claude desktop after configuring your API keys. The MCP server will run automatically when you interact with Claude.

## License

Apache-2.0
