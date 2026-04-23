# ERC-8004 Agent Identity & Reputation Chatbot

This example demonstrates an agent chatbot focused on [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) onchain agent identity and reputation management using CDP AgentKit.

## What can this chatbot do?

- "What is my agent info?"
- "Update my agent name to DataAnalyzer"
- "Set my MCP endpoint to https://mcp.example.com/"
- "Search for agents with reputation above 80"
- "Give agent 42 a starred rating of 95"
- "Show feedback for agent 42"

## Agent ID Resolution

On startup the chatbot resolves its on-chain agent identity automatically:

1. **`AGENT_ID` env var** — if set, loads that specific agent registration
2. **Wallet search** — searches for agents owned by the wallet address and picks the most recently registered one
3. **New registration** — if no agents exist, registers a fresh one

## Prerequisites

### Node Version

Requires Node.js 20 or higher.

```bash
node --version
```

### API Keys

You'll need:
- [CDP API Key](https://portal.cdp.coinbase.com/access/api)
- [OpenAI API Key](https://platform.openai.com/docs/quickstart#create-and-export-an-api-key)
- [Generate Wallet Secret](https://portal.cdp.coinbase.com/products/wallet-api)

### Environment Variables

Rename `.env-local` to `.env` and set:

| Variable | Required | Description |
|---|---|---|
| `CDP_API_KEY_ID` | Yes | CDP API key ID |
| `CDP_API_KEY_SECRET` | Yes | CDP API key secret |
| `CDP_WALLET_SECRET` | Yes | CDP wallet secret |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `NETWORK_ID` | No | Network ID (default: `base-sepolia`) |
| `AGENT_ID` | No | Explicit agent ID to load (skips wallet search) |
| `PINATA_JWT` | No | Pinata JWT for IPFS metadata storage |
| `ADDRESS` | No | Specific wallet address to use |

## Running the example

From the root directory:

```bash
pnpm install
pnpm build
```

Then from the `typescript/examples/langchain-8004-cdp-chatbot` directory:

```bash
pnpm start
```

Select "1. chat mode" and start managing your agent's onchain identity and reputation.

## License

[Apache-2.0](../../../LICENSE.md)
