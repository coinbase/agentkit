# krewe Inference + AgentKit + LangChain — Chatbot example

This example shows how a LangChain agent can call **[krewe](https://www.krewe.world)** — a decentralized AI inference network on Base mainnet — using AgentKit's built-in `x402ActionProvider`. Each inference call is paid per-request in USDC via the [x402 protocol](https://x402.org); no API keys or pre-paid quotas required.

The agent has a CDP-managed Base wallet and four inference tools through krewe:

| `kind` | Cost | What it does |
|---|---|---|
| `text.structure` | $0.005 | Regex/JSON extraction from unstructured text |
| `text.embed` | $0.01 | Sentence embeddings via a small quantized model |
| `web.scrape` | $0.02 | Fetch + clean a URL payload |
| `text.complete` | $0.05 | Small-language-model completion (greedy decode, server-pinned model) |

Every USDC paid through this example flows directly back to the miners that answered the job — krewe's orchestrator sweeps payments hourly, swaps them for `$KREW` on Uniswap V4, and deposits the proceeds into the registry's reward pool.

## Prompts to try

- `"Extract every email and date from this text: 'RSVP to hi@krewe.world by 2026-05-17 or call us 2026-05-20.'"`
- `"Embed this sentence: 'Decentralized AI inference on Base'."`
- `"Scrape https://www.krewe.world and tell me what the project does."`
- `"Use krewe's text.complete to write a one-sentence summary of x402."`

## Prerequisites

### Node version

Node.js 20 or higher. Check with `node --version`. If you need an upgrade, [`nvm`](https://github.com/nvm-sh/nvm) is the easiest path:

```bash
nvm install node
```

### Keys

- **CDP API key** — https://portal.cdp.coinbase.com/access/api
- **CDP wallet secret** — https://portal.cdp.coinbase.com/products/wallet-api
- **OpenAI API key** — https://platform.openai.com/docs/quickstart#create-and-export-an-api-key

Rename `.env-local` to `.env` and fill in:

```bash
OPENAI_API_KEY=...
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
CDP_WALLET_SECRET=...

# Defaults shown — override if you're pointing at a self-hosted orchestrator
NETWORK_ID=base-mainnet
KREWE_PREDICT_URL=https://krewe-orchestrator-production.up.railway.app/v2/predict
KREWE_MAX_PAYMENT_USDC=0.10
```

### Funding the agent

The agent's CDP wallet needs **USDC on Base mainnet** to pay for inference. The cheapest job (`text.structure`) costs $0.005, so $1 in USDC funds 200 calls. Send USDC to the wallet address printed at startup, or use the CDP funding faucet on Base sepolia and re-point `NETWORK_ID` if you've stood up a sepolia orchestrator.

> Note: krewe's *production* orchestrator runs only on Base mainnet today. The `NETWORK_ID=base-sepolia` path works against a self-hosted orchestrator.

## Running the example

From the repository root:

```bash
pnpm install
pnpm build
```

Then from this directory:

```bash
pnpm start
```

You'll be prompted for **chat** (interactive prompts) or **auto** (autonomous loop that fires a creative krewe job every 30s).

## How the x402 handshake works under the hood

The flow is invisible to your agent code, but worth knowing:

1. Agent calls `https://krewe-orchestrator-production.up.railway.app/v2/predict` with a job body.
2. Orchestrator returns `402 Payment Required` with a signed EIP-3009 challenge specifying the USDC `value`, `to`, `nonce`, and validity window.
3. AgentKit's `x402ActionProvider` (via `@x402/fetch`) signs the challenge with the CDP wallet.
4. Orchestrator verifies the signature, submits `transferWithAuthorization` on the USDC contract, waits for confirmation, then runs the inference job through krewe's miner network.
5. 2-of-3 byte-equal miner consensus produces the output, which is returned along with the on-chain `paymentTxHash`.

Full protocol writeup: [`docs/x402.md`](https://github.com/krewe-AI/krewe/blob/main/docs/x402.md) in the krewe repo.

## Want a self-hosted orchestrator?

The orchestrator is open-source and small (~2k LOC of TypeScript). See [`SETUP.md`](https://github.com/krewe-AI/krewe/blob/main/SETUP.md) in the krewe repo for the dev path, and [`docs/architecture.md`](https://github.com/krewe-AI/krewe/blob/main/docs/architecture.md) for the network model. Point `KREWE_PREDICT_URL` at your instance and this example works against it unchanged.

## Links

- krewe site: https://www.krewe.world
- krewe repo: https://github.com/krewe-AI/krewe
- `$KREW` on Basescan: https://basescan.org/address/0xc411E6deE1F70F57F08714D3bd54b4F36f904B07
- x402 spec: https://x402.org
- AgentKit docs: https://docs.cdp.coinbase.com/agentkit/docs/welcome
