# Gemini CDP Smart Wallet Chatbot Example

This example demonstrates an agent setup as a terminal-style chatbot using Google Gemini with access to the full set of AgentKit actions. A CDP Smart Wallet will be created and owned by the signer passed into the example.

Ask the chatbot to engage in the Web3 ecosystem!

- "Transfer a portion of your ETH to a random address"
- "Use the faucet"
- "What is the price of BTC?"
- "Deploy an ERC-20 token"
- "Swap some ETH for USDC"

## Prerequisites

### Checking Node Version

Before using the example, ensure that you have the correct version of Node.js installed. The example requires Node.js 18 or higher. You can check your Node version by running:

```bash
node --version
```

If you don't have the correct version, you can install it using nvm:

```bash
nvm install node
```

This will automatically install and use the latest version of Node.

### Set ENV Vars

You'll need the following API keys:

- **CDP API Key**: Get from [CDP Portal](https://portal.cdp.coinbase.com/)
- **Gemini API Key**: Get from [Google AI Studio](https://aistudio.google.com/app/apikey)

Once you have them, rename the `.env-local` file to `.env` and make sure you set the API keys to their corresponding environment variables:

**Required:**

```bash
CDP_API_KEY_ID=your_cdp_api_key_id
CDP_API_KEY_SECRET=your_cdp_api_key_secret
CDP_WALLET_SECRET=your_cdp_wallet_secret
GEMINI_API_KEY=your_gemini_api_key
```

**Optional:**

```bash
PRIVATE_KEY= # (if not provided, a new key will be generated)
NETWORK_ID=base-sepolia # (defaults to base-sepolia if not set)
PAYMASTER_URL= # (for gasless transactions)
```

## Running the Example

From the root directory, run:

```bash
npm install
npm run build
```

This will install the dependencies and build the packages locally. The chatbot example uses the local `@coinbase/agentkit-gemini` and `@coinbase/agentkit` packages. If you make changes to the packages, you can run `npm run build` from root again to rebuild the packages, and your changes will be reflected in the chatbot example.

Now from the `typescript/examples/gemini-cdp-chatbot` directory, run:

```bash
npm start
```

## Features

- **Natural Language Processing**: Powered by Google Gemini for understanding complex requests
- **Function Calling**: Automatic execution of AgentKit functions based on user intent
- **Error Handling**: Graceful handling of errors with helpful feedback
- **Interactive Chat**: Terminal-based chat interface with command history
- **Web3 Integration**: Full access to CDP AgentKit's Web3 capabilities

## Available Commands

- **Transfer ETH**: Send ETH to any address
- **Check Balance**: View your wallet balance
- **Get Faucet Funds**: Request test ETH from faucet
- **Token Prices**: Get current cryptocurrency prices
- **Deploy Contracts**: Deploy ERC-20 tokens and other contracts
- **Swap Tokens**: Exchange tokens using DEX protocols
- **Register ENS**: Register Ethereum Name Service domains
- **Help**: Display available commands
- **Quit**: Exit the chatbot

## Architecture

The example demonstrates:

1. **AgentKit Integration**: Uses `@coinbase/agentkit` for Web3 operations
2. **Gemini Integration**: Uses `@coinbase/agentkit-gemini` for AI-powered function calling
3. **Schema Conversion**: Automatic conversion of Zod schemas to Gemini's OpenAPI format
4. **Function Execution**: Seamless execution of AgentKit functions from Gemini responses
5. **Error Handling**: Robust error handling and user feedback

## Troubleshooting

### Common Issues

1. **Missing API Keys**: Make sure you've renamed `.env-local` to `.env` and set all required variables
2. **Network Issues**: Ensure you're connected to the internet and the specified network is accessible
3. **Insufficient Funds**: Use the faucet command to get test ETH for transactions
4. **Rate Limits**: If you hit API rate limits, wait a moment before trying again

### Getting Help

- Check the console output for detailed error messages
- Use the `help` command to see available options
- Ensure your API keys have the necessary permissions

## License

Apache-2.0
