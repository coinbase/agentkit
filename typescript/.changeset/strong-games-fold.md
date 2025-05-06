---
"@coinbase/agentkit": minor
---

## Description

This change introduces a new action provider for the OKX DEX integration, allowing users to interact with the OKX DEX through the AgentKit framework. The implementation includes a chatbot example that demonstrates how to use the new action provider.
## Motivation

The motivation behind this change is to provide users with an easy way to interact with the OKX DEX using the AgentKit framework. By adding this new action provider, we aim to enhance the user experience and make it easier for developers to integrate with the OKX DEX.

## Changes
- Added a new action provider for the OKX DEX integration
- Implemented a chatbot example that demonstrates how to use the new action provider
- Added comprehensive test coverage for the action provider
- Included detailed documentation and usage examples

## Testing
To test the new action provider and chatbot example, follow these steps:
1. Clone the repository and navigate to the typescript directory.
2. Install the required dependencies by running `pnpm install`.
3. Build the project using `pnpm build`.
4. Navigate to the `examples/langchain-okx-chatbot` directory.
5. Add the required environment variables to the `.env` file:
   - `OKX_API_KEY`
   - `OKX_API_SECRET`
   - `OKX_PASSPHRASE`
   - `OKX_API_URL`
   - `SOLANA_RPC_URL`
   - `SOLANA_PRIVATE_KEY`
   - `OPENAI_API_KEY`
6. Run the chatbot example using `pnpm start`.
7. Interact with the chatbot to test the new action provider.
8. Use the chatbot to ask for a swap quote by typing "Get a swap quote".
9. The chatbot will respond with a prompt asking for the swap details.
