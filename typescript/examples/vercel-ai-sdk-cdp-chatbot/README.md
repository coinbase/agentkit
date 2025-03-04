# CDP Vercel AI SDK Example - Chatbot

This example demonstrates how to use the CDP Vercel AI SDK to create a chatbot that can interact with the Coinbase Developer Platform.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
export CDP_API_KEY_NAME=<your-api-key-name>
export CDP_API_KEY_PRIVATE_KEY=$'<your-private-key>'
export OPENAI_API_KEY=<your-openai-api-key>
export NETWORK_ID=base-sepolia  # Optional: Defaults to base-sepolia
```

3. Run the chatbot:
```bash
npm start
```

## Usage

The chatbot can:
- Execute CDP operations through natural language
- Handle streaming responses
- Use all available CDP tools through the Vercel AI SDK 