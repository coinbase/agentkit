# dTelecom Voice Agent Example

A voice AI agent that uses **Coinbase AgentKit** for wallet management and **dTelecom** for decentralized voice infrastructure (WebRTC, speech-to-text, text-to-speech).

The agent creates a voice session, starts listening for speech, processes it through an LLM, and responds with synthesized speech — all in real time.

## Prerequisites

1. **Coinbase Developer Platform (CDP) account** — [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com)
2. **OpenAI API key** — for the voice agent's LLM
3. **USDC on Base mainnet** — the CDP wallet needs USDC to purchase dTelecom credits via x402

## Setup

1. Install dependencies (from the typescript workspace root):

```bash
cd typescript
pnpm install
```

2. Edit `.env-local` with your credentials:

```
OPENAI_API_KEY=sk-...
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
CDP_WALLET_SECRET=...
NETWORK_ID=base-mainnet
```

3. Run the example once to create a wallet:

```bash
cd examples/dtelecom-voice-agent
pnpm start
```

It will print `Wallet address: 0x...` and fail (no USDC yet). Add the address to `.env-local`:

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
4. Start the AI voice agent server-side
5. Open `http://localhost:3000` in your browser

Allow microphone access and start talking.

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
       │◄── WebRTC audio ────────────►│  Voice Agent
       │                              │    ├── STT (dTelecom)
       │                              │    ├── LLM (OpenAI)
       │                              │    └── TTS (dTelecom)
       │                              │
       └──────── dTelecom SFU ────────┘
```

- **WebRTC**: Real-time audio streaming via dTelecom's decentralized SFU network
- **STT**: Speech-to-text converts user speech to text
- **LLM**: OpenAI GPT-4o-mini generates a conversational response
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
