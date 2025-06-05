# ZeroDev + Agent Kit Example

ZeroDev is a smart wallet provider that enables your agents to:

- Send gasless transactions on any chain.
- Batch transactions (e.g. approve + transfer).
- Spend tokens from one chain on another, i.e. "chain abstraction"
  - This means your agent can receive tokens on chain A, and spend the tokens on chain B.
- Spend USDC/USDT interexchangably.

The best part is that ZeroDev can be used on top of any EVM wallet provider.  For example, if you are managing keys for your agents locally, you can use the ZeroDev with the Viem wallet provider.  If you are using a third-party signing service such as CDP or Privy, you can use those wallet providers with ZeroDev as well.

## Example

This example demonstrates an agent setup using the ZeroDevWalletProvider with a EVM wallet as the signer. It shows how to:

1. Initialize a Viem/PrivyEvm/CDP wallet provider
2. Use the EVM wallet as a signer for the ZeroDev wallet provider
3. Create an AgentKit instance with the ZeroDev wallet provider
4. Set up LangChain tools using the AgentKit instance
5. Create a LangChain agent that uses those tools
6. Run the agent in either chat mode or autonomous mode

## Using the example

You can interact with this agent via chat.

Try running the agent on Base but send USDC to it on Arbitrum.  In fact, feel free to send some USDT too.

Then try asking the agent to do something on Base with their USDC/USDT.  For example, try transferring some USDC to yourself on Base, e.g. "send 1 USDC to <MY_ADDRESS>."

You will notice that:

- Even though your agent's funds are actually on Arbitrum, it can nevertheless *spend* funds on Base.
- Your agent can spend USDT as if it's USDC, and vice versa.
- Also, your agent does NOT have to manage any gas.

## Prerequisites

You'll need the following API keys:

- [ZeroDev Project ID](https://dashboard.zerodev.app/) -- create a project and copy the project ID, as described [here](https://docs.zerodev.app/sdk/getting-started/tutorial).
  - Make sure to create a "gas policy" if you want your agent to send gasless transactions.
- [OpenAI API Key](https://platform.openai.com/api-keys) - For the LLM

You can run the example with any signer including CDP, Privy, and Viem (local keys).  For example, if you want to run with CDP as a signer, then you also need:

- [CDP API Key](https://portal.cdp.coinbase.com/projects/api-keys) - For the CDP wallet

Once you have them, rename the `.env-local` file to `.env` and make sure you set the API keys to their corresponding environment variables:

- "OPENAI_API_KEY"
- "CDP_API_KEY_ID"
- "CDP_API_KEY_SECRET"
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
