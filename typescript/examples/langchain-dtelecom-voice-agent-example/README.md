# dTelecom Voice Agent Example

A voice AI agent that uses **Coinbase AgentKit** with a **LangChain ReAct agent** for on-chain actions and **dTelecom** for decentralized voice infrastructure (WebRTC, speech-to-text, text-to-speech).

Users can speak commands like "Check my USDC balance" or "Send 1 USDC to 0x..." — the agent reasons about which on-chain tools to call, executes them, and speaks the result back.

## Prerequisites

1. **Coinbase Developer Platform (CDP) account** — [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com)
2. **OpenAI API key** — for the ReAct agent's LLM
3. **USDC on Base mainnet** — the CDP wallet needs USDC to purchase dTelecom credits via x402

## Setup

1. Install dependencies (from the typescript workspace root):

```bash
cd typescript
pnpm install
```

2. Copy `.env-local` to `.env` and fill in your credentials:

```bash
cd examples/langchain-dtelecom-voice-agent-example
cp .env-local .env
```

```
OPENAI_API_KEY=sk-...
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
CDP_WALLET_SECRET=...
NETWORK_ID=base-mainnet
```

3. Run the example once to create a wallet:

```bash
pnpm start
```

It will print `Wallet address: 0x...` and fail (no USDC yet). Add the address to `.env`:

```
ADDRESS=0x...
```

4. Send USDC on Base mainnet to the printed wallet address. Even $0.50 is enough for testing.

## Run

```bash
pnpm start
```

This will:

1. Load the CDP wallet on Base mainnet
2. Check dTelecom credit balance (auto-purchases $0.10 if below threshold)
3. Create a 1-minute voice session (WebRTC + STT + TTS)
4. Start the AI voice agent with on-chain tools (wallet, ERC20, dTelecom)
5. Open `http://localhost:3000` in your browser

Allow microphone access and start talking. Try commands like:

- "What's my wallet address?"
- "Check my USDC balance"
- "Send 0.01 USDC to 0x..."
- "How many dTelecom credits do I have?"

## Session Defaults

The example creates a minimal session to keep costs low:

- **Duration**: 1 minute (`durationMinutes: 1`)
- **TTS characters**: 500 (`ttsMaxCharacters: 500`)
- **Cost**: ~11,000 microcredits (~$0.01)

To run longer sessions, increase these values in `voice-agent.ts`:

```typescript
const session = await invoke("DtelecomActionProvider_create_agent_session", {
  durationMinutes: 10,        // 10-minute session
  ttsMaxCharacters: 10000,    // 10K characters of speech synthesis
  // ...
});
```

A 10-minute session with 10K TTS characters costs ~150,000 microcredits (~$0.15).

## How It Works

```
Browser (client.html)          Server (voice-agent.ts)
       │                              │
       │◄── WebRTC audio ────────────►│  VoiceAgent
       │                              │    ├── STT (dTelecom)
       │                              │    ├── AgentKitLLM adapter
       │                              │    │     └── LangChain ReAct agent
       │                              │    │           ├── wallet tools
       │                              │    │           ├── ERC20 tools
       │                              │    │           └── dTelecom tools
       │                              │    └── TTS (dTelecom)
       │                              │
       └──────── dTelecom SFU ────────┘
```

- **WebRTC**: Real-time audio streaming via dTelecom's decentralized SFU network
- **STT**: Speech-to-text converts user speech to text
- **AgentKitLLM**: Custom adapter that bridges VoiceAgent with a LangChain ReAct agent
- **ReAct Agent**: Reasons about which on-chain tools to call (wallet, ERC20, dTelecom)
- **TTS**: Text-to-speech synthesizes the response as audio
- **x402**: Credits purchased automatically using USDC from the CDP wallet

## Supported Languages

Pass a language code to `createAgentSession`:

| Code | Language |
|------|----------|
| `a` | English (US) |
| `b` | English (UK) |
| `e` | Spanish |
| `f` | French |
| `h` | Hindi |
| `i` | Italian |
| `j` | Japanese |
| `p` | Portuguese (BR) |
| `z` | Chinese (Mandarin) |
