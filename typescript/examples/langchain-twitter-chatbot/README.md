# CDP Agentkit Twitter LangChain Extension Examples - Chatbot Typescript

This example demonstrates an agent setup as a terminal style chatbot with access to Twitter (X) API actions.

## Ask the chatbot to engage in the Web3 ecosystem!
- "What are my account details?"
- "Please post a message for me to Twitter"
- "Please get my mentions"
- "Please post responses to my mentions"

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

### Twitter Application Setup

1. Visit the Twitter (X) [Developer Portal](https://developer.x.com/en/portal/dashboard)
2. Navigate to your project
3. Navigate to your application
4. Edit "User authentication settings"
5. Set "App permissions" to "Read and write and Direct message"
6. Set "Type of App" to "Web App, Automated app or Bot"
7. Set "App info" urls
8. Save
9. Navigate to "Keys and tokens"
10. Regenerate all keys and tokens


### API Keys

You'll need the following API keys:
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)
- [Twitter (X) API Keys](https://developer.x.com/en/portal/dashboard)

Once you have them, rename the `.env-local` file to `.env` and make sure you set the API keys to their corresponding environment variables:

- "OPENAI_API_KEY"
- "TWITTER_ACCESS_TOKEN"
- "TWITTER_ACCESS_TOKEN_SECRET"
- "TWITTER_API_KEY"
- "TWITTER_API_SECRET"

## Running the example

From the root directory, run:

```bash
npm install
npm run build
```

This will install the dependencies and build the packages locally. The chatbot example uses the local `@coinbase/agentkit-langchain` and `@coinbase/agentkit` packages. If you make changes to the packages, you can run `npm run build` from root again to rebuild the packages, and your changes will be reflected in the chatbot example.

Now from the `typescript/examples/langchain-twitter-chatbot` directory, run:

```bash
npm start
```

Select "1. chat mode" and start telling your Agent to do things onchain!

## License

Apache-2.0
