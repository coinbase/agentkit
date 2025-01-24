# CDP Agentkit Farcaster Langchain Extension Examples - Chatbot Typescript

This example demonstrates an agent setup as a terminal style chatbot with access to Farcaster API actions.

## Ask the chatbot to engage in the onchain ecosystem!
- "Please send a cast for me to Farcaster"

## Requirements

- Node.js 18+
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)
- [Farcaster API Keys via Neynar](https://dev.neynar.com/)

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
- "NEYNAR_API_KEY"
- "NEYNAR_MANAGED_SIGNER"

```bash
npm start
```
