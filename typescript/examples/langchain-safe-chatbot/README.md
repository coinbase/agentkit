# Safe AgentKit LangChain Extension Example - Chatbot

This example demonstrates an agent using a Safe-based wallet provider, which allows interactions onchain from a multi-sig Safe. By default, it can create or connect to a Safe on the specified network via a private key.

## Environment Variables

- **OPENAI_API_KEY**: Your OpenAI API key
- **SAFE_AGENT_PRIVATE_KEY**: The private key that controls the Safe
- **NETWORK_ID**: The network ID, e.g., "base-sepolia", "ethereum-mainnet", etc.
- **SAFE_ADDRESS** (optional): If already deployed, specify your existing Safe address. Otherwise, a new Safe is deployed.

## Usage

1. Install dependencies from the monorepo root:
   ```bash
   npm install
   npm run build
   ```
2. Navigate into this folder:
   ```bash
   cd typescript/examples/langchain-safe-chatbot
   ```
3. Copy `.env-local` to `.env` and fill the variables:
   ```bash
   cp .env-local .env
   ```
4. Run:
   ```bash
   npm start
   ```
5. Choose the mode: "chat" for user-driven commands, or "auto" for an autonomous demonstration.
