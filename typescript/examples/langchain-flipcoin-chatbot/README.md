# FlipCoin LangChain Chatbot Example

Minimal AgentKit + LangChain agent that trades on [**FlipCoin**](https://www.flipcoin.fun) — a LMSR-based prediction-market protocol on Base.

The agent gets 5 FlipCoin tools (list markets, quote odds, buy / sell shares, read portfolio) via the `flipcoinActionProvider`, signs EIP-712 `TradeIntent`s with a local viem wallet, and submits them to FlipCoin's relayer (gasless execution).

## Setup

```bash
pnpm install
cp .env.example .env     # fill in the values below
pnpm start               # interactive chat mode
pnpm start autonomous    # autonomous bettor mode
```

### Environment variables

| Var | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | yes | LLM backing the agent. |
| `PRIVATE_KEY` | yes | 0x-prefixed EVM private key. This is the **trader** wallet and MUST match the FlipCoin API key's owner address. |
| `FLIPCOIN_API_KEY` | yes | FlipCoin agent API key with `trade` and `portfolio:read` scopes. Create one at https://www.flipcoin.fun/app/settings. |
| `BASE_RPC_URL` | no | Override the default Base mainnet RPC. |
| `FLIPCOIN_BASE_URL` | no | Override the FlipCoin API base URL (defaults to `https://www.flipcoin.fun`). |
| `AGENT_INTERVAL_SECONDS` | no | Seconds between autonomous iterations (default 120). |

### Pre-flight

Before the agent can trade you need:

1. **USDC in the FlipCoin vault.** Deposit via `POST /api/agent/vault/deposit/intent` → sign → `/relay`. The agent-starter kit (https://github.com/flipcoin-fun/flipcoin-agent-starter) ships with a one-command helper.
2. **ShareToken approval for sells only.** Call `ShareToken.setApprovalForAll(router, true)` once per chain from the trader wallet.

## Modes

### Chat mode (default)

Interactive REPL. Ask the agent to fetch markets, quote a trade, or make a bet. Example:

```
You > what are the 5 hottest markets right now?
Agent > [calls get_prediction_markets with limit=5, summarizes]

You > buy $1 of YES on the BTC $200k market
Agent > [calls get_market_odds to preview, then buy_prediction_shares]
```

### Autonomous mode

The agent loops on a short list of trading prompts: scan markets, look for mispriced odds, place small trades, review portfolio for profit-taking. Use with caution — real money moves on each iteration. Start with a tiny vault balance ($5–10) while you tune the prompts.

## How the trade flow works

```text
User / auto prompt
        │
        ▼
LangChain agent picks tool ─► buy_prediction_shares(conditionId, side, amountUsdc)
        │
        ▼
POST /api/agent/trade/intent  ──── FlipCoin returns { intentId, typedData, quote }
        │
        ▼
ViemWalletProvider.signTypedData(typedData)  ─── trader signs EIP-712 TradeIntent
        │
        ▼
POST /api/agent/trade/relay { intentId, signature }  ─── FlipCoin relayer broadcasts
        │
        ▼
Transaction confirmed on Base ─► txHash returned to the LLM
```

## Safety knobs

- `maxSlippageBps` defaults to 200 (2%). Pass a smaller value for tighter control.
- FlipCoin enforces a protocol-level price-impact guard; if `priceImpactGuard.level === "blocked"` the provider short-circuits before signing.
- Autonomous mode rotates between a small prompt bank (edit `chatbot.ts` to customize).

## Links

- FlipCoin docs: https://www.flipcoin.fun/docs/agents
- Agent API (OpenAPI): https://www.flipcoin.fun/api/openapi.json
- Agent starter kit (TS): https://github.com/flipcoin-fun/flipcoin-agent-starter
- Python SDK: https://pypi.org/project/flipcoin/
- MCP server: https://github.com/flipcoin-fun/flipcoin-mcp
