# dTelecom Action Provider

This provider integrates [dTelecom](https://dtelecom.org) decentralized voice infrastructure into AgentKit, enabling AI agents to create and manage real-time voice sessions with WebRTC, speech-to-text (STT), and text-to-speech (TTS).

## Overview

dTelecom provides decentralized communication infrastructure paid via the [x402 payment protocol](https://www.x402.org/) using USDC on Base. This provider wraps the `@dtelecom/x402-client` SDK to expose all gateway operations as AgentKit actions.

## Setup

No configuration required — the provider uses the default gateway URL (`https://x402.dtelecom.org`) and derives authentication from the EVM wallet provider.

```typescript
import { AgentKit } from "@coinbase/agentkit";
import { dtelecomActionProvider } from "@coinbase/agentkit";

const agentkit = await AgentKit.from({
  walletProvider,
  actionProviders: [dtelecomActionProvider()],
});
```

## Actions

| Action | Description |
|--------|-------------|
| `buy_credits` | Buy credits with USDC via x402 payment |
| `get_account` | Get account balance and limits |
| `get_transactions` | List credit transactions |
| `get_sessions` | List active and completed sessions |
| `create_agent_session` | Create bundled WebRTC + STT + TTS session |
| `extend_agent_session` | Extend a bundled session |
| `create_webrtc_token` | Create standalone WebRTC room token |
| `extend_webrtc_token` | Extend WebRTC token duration |
| `create_stt_session` | Create standalone STT session |
| `extend_stt_session` | Extend STT session duration |
| `create_tts_session` | Create standalone TTS session |
| `extend_tts_session` | Extend TTS session character limit |

## Supported Languages

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

## Network Support

This provider supports EVM networks. Payments are processed on Base mainnet using USDC.

## Dependencies

- `@dtelecom/x402-client` — dTelecom gateway SDK

## Example

See the [langchain-dtelecom-voice-agent-example](../../../examples/langchain-dtelecom-voice-agent-example/) for a complete voice agent using this provider with `@dtelecom/agents-js`.
