# CDP Agentkit Twitter LangChain Extension Examples - Chatbot Typescript

This example demonstrates an agent setup as a terminal style chatbot with access to Twitter (X) API actions.

## Ask the chatbot to engage in the Web3 ecosystem!
- "What are my account details?"
- "Please post a message for me to Twitter"
- "Please get my mentions"
- "Please post responses to my mentions"

## Requirements

- Node.js 18+
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)
- [Twitter (X) API Keys](https://developer.x.com/en/portal/dashboard)
- [CDP API Key](https://portal.cdp.coinbase.com/access/api)

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

### Checking Node Version

Before using the example, ensure that you have the correct version of Node.js installed. The example requires Node.js 18 or higher. You can check your Node version by running:

```bash
node --version
npm --version
```

## Installation

```bash
npm install
```

## Run the Chatbot

Ensure the following vars are set in .env:
- "OPENAI_API_KEY"
- "TWITTER_ACCESS_TOKEN"
- "TWITTER_ACCESS_TOKEN_SECRET"
- "TWITTER_API_KEY"
- "TWITTER_API_SECRET"
- "CDP_API_KEY_NAME"
- "CDP_API_KEY_PRIVATE_KEY"

```bash
npm start
```
