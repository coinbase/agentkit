# CDP Agentkit Farcaster LangChain Extension Examples - Chatbot Typescript

This example demonstrates an agent setup as a terminal style chatbot with access to Farcaster API actions.

## Ask the chatbot to engage in the onchain ecosystem!
- "Please send a cast for me to Farcaster"

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

### Farcaster Application Setup

1. Visit the Neynar [Developer Portal](https://dev.neynar.com/)
2. Navigate to your application
3. Copy the API key. 
4. Set the copied value in .env as your `NEYNAR_API_KEY`
5. Return to the Neynar [Developer Portal](https://dev.neynar.com/)
6. Navigate to your application
7. Follow the instructions to get a signer UUID by either creating an agent or logging into Farcaster with an existing account.
8. Copy the signer UUID.
9. Set the copied UUID value in .env as your `NEYNAR_MANAGED_SIGNER`.

### API Keys

You'll need the following API keys:
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)
- [Farcaster API Keys via Neynar](https://dev.neynar.com/)

Once you have them, rename the `.env-local` file to `.env` and make sure you set the API keys to their corresponding environment variables:

- "OPENAI_API_KEY"
- "NEYNAR_API_KEY"
- "NEYNAR_MANAGED_SIGNER"

## Running the example

From the root directory, run:

```bash
npm install
npm run build
```

This will install the dependencies and build the packages locally. The chatbot example uses the local `@coinbase/agentkit-langchain` and `@coinbase/agentkit` packages. If you make changes to the packages, you can run `npm run build` from root again to rebuild the packages, and your changes will be reflected in the chatbot example.

Now from the `typescript/examples/langchain-farcaster-chatbot` directory, run:

```bash
npm start
```

Select "1. chat mode" and start telling your Agent to do things onchain!

## License

Apache-2.0
